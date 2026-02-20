import type { Command } from "commander";
import { promptHandler } from "./handler";

const anythingLlmDefaultWorkspaceSlug =
	process.env.ANYTHING_LLM_DEFAULT_WORKSPACE_SLUG;

export function registerPromptCommand(program: Command) {
	program
		.command("prompt")
		.alias("p")
		.description("Send a prompt")
		.argument("<message...>", "The prompt message to send")
		.option(
			`-w, --workspace <slug>`,
			"Workspace slug to use. Defaults to ANYTHING_LLM_DEFAULT_WORKSPACE_SLUG environment variable.",
			anythingLlmDefaultWorkspaceSlug,
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
		.action(promptHandler);
}
