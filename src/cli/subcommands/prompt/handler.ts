import { AnythingLLM } from "../../../sdk";
import { readStdin } from "./utils/read_stdin";

const DEFAULT_WORKSPACE_SLUG = "anythingllm-cli-default-workspace";

export async function promptHandler(
	messageArgs: string[],
	opts: {
		workspace?: string;
		thread?: string;
		stream: boolean;
		newThread?: boolean;
		attach?: string[];
	},
) {
	const prompt = messageArgs.join(" ");

	const anythingLlmApiKey = process.env.ANYTHING_LLM_API_KEY;
	if (!anythingLlmApiKey) {
		console.error("ANYTHING_LLM_API_KEY environment variable is not set");
		process.exit(1);
	}

	let stdinput = "";
	if (!process.stdin.isTTY) {
		stdinput = await readStdin();
	}

	const constructedPrompt = stdinput ? `${stdinput} ${prompt}` : prompt;

	const attachments = opts.attach
		? opts.attach.map(AnythingLLM.fileToAttachment)
		: undefined;

	const client = new AnythingLLM({
		apiKey: anythingLlmApiKey,
		baseUrl: process.env.ANYTHING_LLM_BASE_URL,
	});

	const workspaceSlug = opts.workspace || DEFAULT_WORKSPACE_SLUG;

	// No workspace specified — ensure the default workspace exists, creating it if needed.
	if (workspaceSlug === DEFAULT_WORKSPACE_SLUG) {
		const getWorkspaceResult = await client.workspaces.get({
			slug: workspaceSlug,
		});

		if (!getWorkspaceResult.ok) {
			console.error(
				`Failed to get workspace "${workspaceSlug}": ${getWorkspaceResult.error}`,
			);
			process.exit(1);
		}

		if (getWorkspaceResult.data.workspace.length === 0) {
			const workspaceResult = await client.workspaces.create({
				name: `AnythingLLM CLI Default Workspace`,
				systemPrompt: `You are a helpful assistant responding to prompts from the AnythingLLM CLI tool. You will sometimes receive context passed in from the stdinput.`,
			});

			if (!workspaceResult.ok) {
				console.error(`Failed to create workspace: ${workspaceResult.error}`);
				process.exit(1);
			}
		}
	}
	let threadSlug: string | undefined = opts.thread;
	if (opts.newThread) {
		const threadResult = await client.threads.create({
			workspaceSlug,
			title: `AnythingLLM CLI Thread - ${new Date().toLocaleString()}`,
		});

		if (!threadResult.ok) {
			console.error(`Failed to create thread: ${threadResult.error}`);
			process.exit(1);
		}

		threadSlug = threadResult.data.thread.slug;
	}

	if (!opts.stream) {
		const result = threadSlug
			? await client.threads.chat({
					threadSlug,
					message: constructedPrompt,
					workspaceSlug,
					attachments,
				})
			: await client.workspaces.chat({
					slug: workspaceSlug,
					message: constructedPrompt,
					attachments,
				});

		if (!result.ok) {
			console.error(`LLM request failed: ${result.error}`);
			process.exit(1);
		}

		process.stdout.write(`${result.data.textResponse}\n`);
		return;
	}

	const stream = threadSlug
		? client.threads.streamChat({
				workspaceSlug,
				threadSlug,
				mode: "chat",
				message: constructedPrompt,
				attachments,
			})
		: client.workspaces.streamChat({
				slug: workspaceSlug,
				mode: "chat",
				message: constructedPrompt,
				attachments,
			});

	// Disable ANSI codes when piped to a file so output is clean plaintext.
	const isTTY = process.stdout.isTTY === true;
	const dim = isTTY ? "\x1b[2m" : "";
	const reset = isTTY ? "\x1b[0m" : "";
	let assembling = false;
	let lastAssembly = "";
	let hasResponse = false;

	// Tool call assembly comes as incremental chunks (e.g. "web-browsing({"query":" ...).
	// In a TTY we overwrite the same line with \r; when piped we suppress the
	// incremental updates and write only the final assembled line here.
	const endAssembly = () => {
		if (!assembling) return;
		if (!isTTY && lastAssembly) {
			process.stdout.write(`${lastAssembly}\n`);
		} else {
			process.stdout.write("\n");
		}
		assembling = false;
		lastAssembly = "";
	};

	// Adds a blank line separator before the first response token
	// so the actual answer is visually separated from agent metadata.
	const writeResponse = (text: string) => {
		endAssembly();
		if (!hasResponse) {
			process.stdout.write("\n");
			hasResponse = true;
		}
		process.stdout.write(text);
	};

	let inThinkBlock = false;
	let tagBuffer = "";

	// Returns the length of a suffix of `text` that matches a prefix of `tag`,
	// so we can buffer partial tags across streaming chunks.
	const findPartialTagSuffix = (text: string, tag: string): number => {
		for (let len = Math.min(text.length, tag.length - 1); len > 0; len--) {
			if (text.endsWith(tag.substring(0, len))) return len;
		}
		return 0;
	};

	// Process streamed text that may contain <think>...</think> tags.
	// Strips the tags, dims thinking content, and writes the real response normally.
	const processTextToken = (text: string) => {
		const combined = tagBuffer + text;
		tagBuffer = "";
		let pos = 0;

		while (pos < combined.length) {
			if (!inThinkBlock) {
				const openIdx = combined.indexOf("<think>", pos);
				if (openIdx !== -1) {
					if (openIdx > pos) writeResponse(combined.substring(pos, openIdx));
					inThinkBlock = true;
					process.stdout.write(`${dim}Thinking...\n`);
					pos = openIdx + 7;
				} else {
					const remainder = combined.substring(pos);
					const partial = findPartialTagSuffix(remainder, "<think>");
					if (partial > 0) {
						const safe = remainder.substring(0, remainder.length - partial);
						if (safe) writeResponse(safe);
						tagBuffer = remainder.substring(remainder.length - partial);
					} else {
						writeResponse(remainder);
					}
					pos = combined.length;
				}
			} else {
				const closeIdx = combined.indexOf("</think>", pos);
				if (closeIdx !== -1) {
					if (closeIdx > pos)
						process.stdout.write(combined.substring(pos, closeIdx));
					process.stdout.write(`\n...done thinking.${reset}\n`);
					inThinkBlock = false;
					pos = closeIdx + 8;
				} else {
					const remainder = combined.substring(pos);
					const partial = findPartialTagSuffix(remainder, "</think>");
					if (partial > 0) {
						const safe = remainder.substring(0, remainder.length - partial);
						if (safe) process.stdout.write(safe);
						tagBuffer = remainder.substring(remainder.length - partial);
					} else {
						process.stdout.write(remainder);
					}
					pos = combined.length;
				}
			}
		}
	};

	for await (const chunk of stream) {
		// Regular (non-agent) chat token
		if (chunk.type === "textResponseChunk") {
			processTextToken(chunk.textResponse);
		} else if (chunk.type === "agentThought") {
			endAssembly();
			process.stdout.write(`${dim}${chunk.thought}${reset}\n`);
		} else if (chunk.type === "textResponse" && chunk.textResponse) {
			const resp = chunk.textResponse as { type: string; content: string };
			if (resp.type === "toolCallInvocation") {
				// In a TTY, overwrite the current line to show assembly progress in place.
				if (isTTY) {
					process.stdout.write(`\r\x1b[K${dim}${resp.content}${reset}`);
				}
				lastAssembly = resp.content;
				assembling = true;
			} else if (resp.type === "textResponseChunk") {
				// Agent response token
				writeResponse(resp.content);
			}
		}
	}

	// Flush any remaining buffered partial-tag content
	if (tagBuffer) {
		if (inThinkBlock) {
			process.stdout.write(tagBuffer);
		} else {
			writeResponse(tagBuffer);
		}
	}
	// Ensure dim is reset if stream ended mid-think
	if (inThinkBlock) process.stdout.write(reset);

	process.stdout.write("\n");
}
