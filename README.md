# AnythingLLM CLI

A fast, lightweight command-line interface for chatting with your [AnythingLLM](https://anythingllm.com) instance directly from the terminal. Pipe in context, stream responses, and manage conversations — all without leaving your shell.

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║  █████  ███   ██ ██   ██ ████████ ██  ██ ██ ███   ██  ██████  ║
║ ██   ██ ████  ██  ██ ██     ██    ██  ██ ██ ████  ██ ██       ║
║ ███████ ██ ██ ██   ████     ██    █████  ██ ██ ██ ██ ██  ███  ║
║ ██   ██ ██  ████    ██      ██    ██  ██ ██ ██  ████ ██   ██  ║
║ ██   ██ ██   ███    ██      ██    ██  ██ ██ ██   ███  ██████  ║
║                                                                ║
║                    ██      ██      ██   ██                     ║
║                    ██      ██      ███ ███                     ║
║                    ██      ██      ██ █ ██                     ║
║                    ██      ██      ██   ██                     ║
║                    ███████ ███████ ██   ██                     ║
║                                                                ║
║    ✦ Chat with your AnythingLLM instance from the terminal ✦   ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

## Install

### Via npm (recommended)

```bash
npm install -g anything-llm-cli
```

This installs the `any` command globally.

### Install script (macOS/Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/Mintplex-Labs/anything-llm-cli/main/install.sh | sh
```

This detects your platform, downloads the latest binary, and installs it to `/usr/local/bin`. Run it again to update.

### Standalone binary

Download a prebuilt binary for your platform from the [Releases](https://github.com/mintplex-labs/anything-llm-cli/releases) page and place it somewhere on your `PATH`.

| Platform      | Binary               |
| ------------- | -------------------- |
| macOS ARM     | `any-darwin-arm64`   |
| macOS Intel   | `any-darwin-x64`     |
| Linux x64     | `any-linux-x64`      |
| Linux ARM     | `any-linux-arm64`    |
| Windows x64   | `any-windows-x64.exe`|

### From source

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/mintplex-labs/anything-llm-cli.git
cd anything-llm-cli
bun run setup
```

This installs dependencies and creates a `.env.local` file from `.env.example`. Open `.env.local` and fill in your values (see [Environment Variables](#environment-variables) below).

Then run with:

```bash
bun run start prompt "Hello!"
```

Or compile a native binary:

```bash
bun run build
./dist/any prompt "Hello!"
```

## Setup

The only required setup is your API key. You can generate one from your AnythingLLM instance under **Settings > Developer API**.

If running from source, fill in your `.env.local` file — Bun loads it automatically.

For the npm package or standalone binary, set environment variables directly:

```bash
export ANYTHING_LLM_API_KEY="your-api-key"
export ANYTHING_LLM_BASE_URL="https://my-instance.example.com"  # optional, default: http://localhost:3001
export ANYTHING_LLM_DEFAULT_WORKSPACE_SLUG="my-workspace"       # optional, avoids needing -w
```

If no workspace is specified via `-w` or the environment variable, the CLI will automatically create and use a default workspace.

> **Tip:** Add these to your `.bashrc`, `.zshrc`, or `.env` file for persistence.

## Usage

```
any prompt <message> [options]
```

Running `any` with no arguments displays the help screen.

### Commands

| Command | Alias | Description |
| --- | --- | --- |
| `prompt <message...>` | `p` | Send a prompt to the LLM |

### Options (for `prompt`)

| Flag | Description |
| --- | --- |
| `-w, --workspace <slug>` | Workspace slug. Falls back to `ANYTHING_LLM_DEFAULT_WORKSPACE_SLUG` env var, or auto-creates a default workspace |
| `-a, --attach <path...>` | Attach files to the prompt (images, PDFs, etc.) |
| `-t, --thread [slug]` | Use a specific thread for the conversation |
| `--nt, --new-thread` | Start a new thread for this conversation |
| `-S, --no-stream` | Disable streaming (wait for full response) |

#### Supported attachment types

`png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`, `pdf`, `txt`, `csv`, `json`, `md`, `doc`, `docx`, `xls`, `xlsx`

### Examples

**Simple prompt:**

```bash
any prompt "What is AnythingLLM?"
```

**Multi-word prompts without quotes:**

```bash
any prompt What is AnythingLLM
```

**Using the short alias:**

```bash
any p "What is AnythingLLM?"
```

**Pipe in context from another command:**

```bash
cat error.log | any prompt "Explain these errors"
```

```bash
git diff | any prompt "Write a commit message for these changes"
```

```bash
curl -s https://api.example.com/data | any prompt "Summarize this JSON"
```

**Use a specific thread for ongoing conversations:**

```bash
any prompt "Let's continue our discussion" -t thread-slug
```

**Start a new thread:**

```bash
any prompt "Start a fresh conversation about testing" --new-thread
```

**Disable streaming (useful for scripting):**

```bash
RESULT=$(any prompt "Give me a one-word answer: yes or no?" -S)
echo "The LLM said: $RESULT"
```

**Save the response to a file:**

```bash
any prompt "Write a summary of AnythingLLM" > summary.md
```

> When piped to a file, ANSI formatting is automatically stripped and agent tool call assembly is cleaned up for readable plaintext output.

**Attach files (images, PDFs, etc.):**

```bash
any prompt "What's in this image?" -a ./photo.png
```

```bash
any prompt "Compare these documents" -a report.pdf notes.pdf
```

```bash
any prompt "Summarize all of these" -a file1.pdf file2.pdf file3.pdf
```

**Agent workspaces:**

Agent workspaces that use tools (web browsing, scraping, etc.) are fully supported. In the terminal, tool call assembly updates in place and agent thoughts are dimmed for readability. When piped to a file, output is clean plaintext.

## TypeScript SDK

The project also includes a fully-typed TypeScript SDK (`AnythingLLM` class) that you can use programmatically:

```typescript
import { AnythingLLM } from "./src/sdk";

const client = new AnythingLLM({
  apiKey: "your-api-key",
  baseUrl: "http://localhost:3001",
});

// Send a chat message
const result = await client.workspaces.chat({
  slug: "my-workspace",
  message: "Hello!",
});

if (result.ok) {
  console.log(result.data.textResponse);
}

// Stream a response
const stream = client.workspaces.streamChat({
  slug: "my-workspace",
  message: "Tell me a story",
  mode: "chat",
});

for await (const chunk of stream) {
  if (chunk.type === "textResponseChunk") {
    process.stdout.write(chunk.textResponse);
  }
}
```

### SDK Methods

| Method | Description |
| --- | --- |
| `workspaces.list()` | List all workspaces |
| `workspaces.get({ slug })` | Get a workspace by slug |
| `workspaces.create({ name, ... })` | Create a new workspace |
| `workspaces.chat({ slug, message })` | Send a message and get a complete response |
| `workspaces.streamChat({ slug, message })` | Stream a response as SSE chunks |
| `threads.create({ workspaceSlug, title })` | Create a new thread in a workspace |
| `threads.chat({ workspaceSlug, threadSlug, message })` | Chat within a thread |
| `threads.streamChat({ workspaceSlug, threadSlug, message })` | Stream a response within a thread |
| `threads.getMessages({ workspaceSlug, threadSlug? })` | Get chat history |

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run start

# Lint and format
bun run lint

# Build for current platform
bun run build

# Build for all platforms
bun run build:all
```

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ANYTHING_LLM_API_KEY` | Yes | — | Your AnythingLLM API key |
| `ANYTHING_LLM_BASE_URL` | No | `http://localhost:3001` | Base URL of your AnythingLLM instance |
| `ANYTHING_LLM_DEFAULT_WORKSPACE_SLUG` | No | — | Default workspace slug (avoids needing `-w` flag) |

## License

[MIT](LICENSE)
