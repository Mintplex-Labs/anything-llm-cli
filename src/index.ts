import { program } from "commander";
import packageJson from "../package.json";
import { AnythingLLM } from "./sdk";
import buildBanner from "./utils/banner.ts";
import fileToAttachment from "./utils/convert_file_to_attachment";

function readStdin(): Promise<string> {
	return new Promise((resolve) => {
		let data = "";
		process.stdin.setEncoding("utf-8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => resolve(data));
	});
}

const anythingLLmDefaultWorkspaceSlug =
	process.env.ANYTHING_LLM_DEFAULT_WORKSPACE_SLUG;

program
	.name("any")
	.description("A simple CLI tool to interact with AnythingLLM")
	.version(packageJson.version)
	.addHelpText("before", buildBanner());

program
	.command("prompt")
	.alias("p")
	.description("Send a prompt")
	.argument("<message...>", "The prompt message to send")
	.requiredOption(
		`-w, --workspace <slug>`,
		"Workspace slug to use. Defaults to ANYTHING_LLM_DEFAULT_WORKSPACE_SLUG environment variable.",
		anythingLLmDefaultWorkspaceSlug,
	)
	.option(
		"-t, --thread [slug]",
		"Thread slug to use. If not provided the default thread for the workspace will be used.",
	)
	.option("-S, --no-stream", "Disable streaming responses")
	.option("--nt, --new-thread", "Start a new thread for this conversation.")
	.option(
		"-a, --attach <path...>",
		"Attach files to the prompt (images, PDFs, etc.)",
	)
	.action(async (messageArgs: string[], opts) => {
		const prompt = messageArgs.join(" ");

		const anythingLlmApiKey = process.env.ANYTHING_LLM_API_KEY;
		if (!anythingLlmApiKey) {
			console.error("ANYTHING_LLM_API_KEY environment variable is not set");
			process.exit(1);
		}

		let stdinput = "";
		if (process.stdin.isTTY === false) {
			stdinput = await readStdin();
		}

		let constructedPrompt = `${prompt}`;

		if (stdinput) {
			constructedPrompt = `${stdinput} ${constructedPrompt}`;
		}

		const attachments = opts.attach
			? (opts.attach as string[]).map(fileToAttachment)
			: undefined;

		const llm = new AnythingLLM({
			apiKey: anythingLlmApiKey,
			baseUrl: process.env.ANYTHING_LLM_BASE_URL,
		});

		let threadSlug: string | undefined = opts.thread;
		if (opts.newThread) {
			const threadResult = await llm.threads.create({
				workspaceSlug: opts.workspace || anythingLLmDefaultWorkspaceSlug,
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
				? await llm.threads.chat({
						threadSlug,
						message: constructedPrompt,
						workspaceSlug: opts.workspace,
						attachments,
					})
				: await llm.workspaces.chat({
						slug: opts.workspace,
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

		const workspaceSlug = opts.workspace;
		const stream = threadSlug
			? llm.threads.streamChat({
					workspaceSlug,
					threadSlug,
					mode: "chat",
					message: constructedPrompt,
					attachments,
				})
			: llm.workspaces.streamChat({
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

		for await (const chunk of stream) {
			// Regular (non-agent) chat token
			if (chunk.type === "textResponseChunk") {
				writeResponse(chunk.textResponse);
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

		process.stdout.write("\n");
	});

program.parse();
