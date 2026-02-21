import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { isCancel, log, note, password, select, text } from "@clack/prompts";

type ShellType = "bash" | "zsh" | "fish";

function detectShell(): ShellType {
	const shell = process.env.SHELL || "";
	if (shell.includes("zsh")) return "zsh";
	if (shell.includes("fish")) return "fish";
	return "bash";
}

function getShellConfigPath(shell: ShellType): string {
	const home = homedir();
	switch (shell) {
		case "zsh":
			return join(home, ".zshrc");
		case "fish":
			return join(home, ".config", "fish", "config.fish");
		case "bash":
			return process.platform === "darwin"
				? join(home, ".bash_profile")
				: join(home, ".bashrc");
	}
}

function formatExportLine(
	shell: ShellType,
	key: string,
	value: string,
): string {
	if (shell === "fish") return `set -gx ${key} "${value}"`;
	return `export ${key}="${value}"`;
}

function getExportPattern(shell: ShellType, key: string): RegExp {
	if (shell === "fish") return new RegExp(`^set\\s+-gx\\s+${key}\\s+.*$`, "m");
	return new RegExp(`^export\\s+${key}=.*$`, "m");
}

async function writeToShellConfig(
	shell: ShellType,
	configPath: string,
	vars: Record<string, string>,
): Promise<void> {
	let content = existsSync(configPath)
		? await readFile(configPath, "utf-8")
		: "";

	for (const [key, value] of Object.entries(vars)) {
		const pattern = getExportPattern(shell, key);
		const exportLine = formatExportLine(shell, key, value);

		if (pattern.test(content)) {
			content = content.replace(pattern, exportLine);
		} else {
			if (content.length > 0 && !content.endsWith("\n")) content += "\n";
			content += `${exportLine}\n`;
		}
	}

	await writeFile(configPath, content, "utf-8");
}

export async function setupHandler() {
	if (process.platform === "win32") {
		log.error(
			"The setup command is only supported on POSIX systems (macOS, Linux).",
		);
		process.exit(1);
	}

	const selection = await select({
		message: "What type of AnythingLLM instance are you connecting to?",
		options: [
			{ value: "desktop", label: "AnythingLLM Desktop" },
			{ value: "web", label: "AnythingLLM Cloud or Self-Hosted" },
		],
	});

	if (isCancel(selection)) {
		log.warn("Setup cancelled.");
		return;
	}

	const isDesktop = selection === "desktop";
	// const isDesktop = await confirm({
	//   message: "Are you using AnythingLLM Desktop?",
	// });

	let anythingLlmBaseUrl = "http://localhost:3001";
	if (!isDesktop) {
		anythingLlmBaseUrl = (await text({
			message: "Enter your AnythingLLM instance URL",
			placeholder: "https://my-anythingllm-instance.com",

			validate: (value) => {
				if (!value) return "URL is required";
				try {
					const url = new URL(value);
					if (url.protocol !== "http:" && url.protocol !== "https:")
						return "Base URL must start with http:// or https://";
					if (!url.hostname) return "Base URL must include a hostname";
				} catch {
					return "Base URL must be a valid URL (e.g. https://my-instance.com)";
				}
				return undefined;
			},
		})) as string;

		if (isCancel(anythingLlmBaseUrl)) {
			log.warn("Setup cancelled.");
			return;
		}
	}

	const anythingLlmApiKey = await password({
		message: "Enter your AnythingLLM API Key",
		mask: "*",
		validate: (value) => {
			if (!value || value.length !== 31)
				return "API Key must be 31 characters long";
			return undefined;
		},
	});

	if (isCancel(anythingLlmApiKey)) {
		log.warn("Setup cancelled.");
		return;
	}

	const normalizedUrl = anythingLlmBaseUrl.replace(/\/+$/, "");
	const shell = detectShell();
	const configPath = getShellConfigPath(shell);

	await writeToShellConfig(shell, configPath, {
		ANYTHING_LLM_BASE_URL: normalizedUrl,
		ANYTHING_LLM_API_KEY: anythingLlmApiKey,
	});

	note(
		`Updated ${configPath}\n\nRun \`source ${configPath}\` or restart your terminal to apply changes.`,
		"Setup complete",
	);
}
