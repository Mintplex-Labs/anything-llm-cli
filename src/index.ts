import { program } from "commander";
import packageJson from "../package.json";
import { AnythingLLM } from "./sdk";
import { buildBanner } from "./utils";

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
  .addHelpText("before", buildBanner())
  .requiredOption("-p, --prompt <prompt>", "Prompt to send to the LLM")
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
  .action(async (opts) => {
    // Show help if no flags and no stdin
    if (!opts.prompt && process.stdin.isTTY) {
      program.help();
    }
    const anythingLlmApiKey = process.env.ANYTHING_LLM_API_KEY;
    if (!anythingLlmApiKey) {
      console.error("ANYTHING_LLM_API_KEY environment variable is not set");
      process.exit(1);
    }

    let stdinput = "";
    if (!process.stdin.isTTY) {
      stdinput = await readStdin();
    }

    const prompt = opts.prompt || process.argv.slice(2)[0];
    if (!prompt && !stdinput) {
      console.error("Usage: allm -p <prompt> or pipe input via stdin");
      process.exit(1);
    }

    if (!opts.workspace) {
      console.error(
        "Workspace slug is required. Set ANYTHING_LLM_DEFAULT_WORKSPACE_SLUG environment variable or use -w flag.",
      );
      process.exit(1);
    }

    let constructedPrompt = `<prompt>${prompt}</prompt>`;

    if (stdinput) {
      constructedPrompt = `<stdinput>${stdinput}</stdinput>${constructedPrompt}`;
    }

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
          })
        : await llm.workspaces.chat({
            slug: opts.workspace,
            message: constructedPrompt,
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
        })
      : llm.workspaces.streamChat({
          slug: workspaceSlug,
          mode: "chat",
          message: constructedPrompt,
        });

    for await (const chunk of stream) {
      if (chunk.type === "textResponseChunk") {
        process.stdout.write(chunk.textResponse);
      }
    }

    process.stdout.write("\n");
  });

program.parse();
