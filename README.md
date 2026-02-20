# AnythingLLM CLI

A command-line interface for chatting with your [AnythingLLM](https://anythingllm.com) instance from the terminal.

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

### Install script (macOS/Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/Mintplex-Labs/anything-llm-cli/main/install.sh | sh
```

This detects your platform, downloads the latest binary, and installs it to `/usr/local/bin`. Run it again to update.

### Via package manager

```bash
npm install -g @mintplex-labs/anything-llm-cli
# or
yarn global add @mintplex-labs/anything-llm-cli
# or
pnpm add -g @mintplex-labs/anything-llm-cli
# or
bun install -g @mintplex-labs/anything-llm-cli
```

### Standalone binary

Download a prebuilt binary from the [Releases](https://github.com/mintplex-labs/anything-llm-cli/releases) page and place it somewhere on your `PATH`.

| Platform    | Binary                |
| ----------- | --------------------- |
| macOS ARM   | `any-darwin-arm64`    |
| macOS Intel | `any-darwin-x64`      |
| Linux x64   | `any-linux-x64`       |
| Linux ARM   | `any-linux-arm64`     |
| Windows x64 | `any-windows-x64.exe` |

## Quickstart

1. **Get your API key** from your AnythingLLM instance under **Settings > Developer API**.

2. **Set your environment variables:**

   ```bash
   export ANYTHING_LLM_API_KEY="your-api-key"
   # Optional — defaults to http://localhost:3001
   export ANYTHING_LLM_BASE_URL="https://my-instance.example.com"
   ```

   > **Tip:** Add these to your `.bashrc` or `.zshrc` for persistence.

3. **Send your first prompt:**

   ```bash
   any prompt "What is AnythingLLM?"
   ```

That's it! If no workspace is specified, the CLI will automatically create and use a default one.

## Usage

```
any prompt <message> [options]
```

### Options

| Flag                     | Description                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `-w, --workspace <slug>` | Workspace slug. Falls back to `ANYTHING_LLM_DEFAULT_WORKSPACE_SLUG` env var, or auto-creates a default workspace |
| `-a, --attach <path...>` | Attach image files to the prompt (png, jpg, jpeg, gif, webp)                                                     |
| `-t, --thread [slug]`    | Use a specific thread for the conversation                                                                       |
| `--nt, --new-thread`     | Start a new thread for this conversation                                                                         |
| `-S, --no-stream`        | Disable streaming (wait for full response)                                                                       |

### Examples

```bash
# Simple prompt (quotes optional)
any prompt What is AnythingLLM

# Pipe in context
cat error.log | any prompt "Explain these errors"
git diff | any prompt "Write a commit message for these changes"

# Use a specific workspace
any prompt "Hello" -w my-workspace

# Threads for ongoing conversations
any prompt "Let's talk about testing" --new-thread
any prompt "Continue where we left off" -t thread-slug

# Attach images
any prompt "What's in this image?" -a ./photo.png

# Scripting (no streaming, capture output)
RESULT=$(any prompt "Give me a one-word answer: yes or no?" -S)

# Save response to a file
any prompt "Write a summary" > summary.md
```

> When piped or redirected, ANSI formatting is automatically stripped for clean plaintext output. Agent workspaces with tools (web browsing, scraping, etc.) are fully supported.

## Environment Variables

| Variable                              | Required | Default                 | Description                                       |
| ------------------------------------- | -------- | ----------------------- | ------------------------------------------------- |
| `ANYTHING_LLM_API_KEY`                | Yes      | —                       | Your AnythingLLM API key                          |
| `ANYTHING_LLM_BASE_URL`               | No       | `http://localhost:3001` | Base URL of your AnythingLLM instance             |
| `ANYTHING_LLM_DEFAULT_WORKSPACE_SLUG` | No       | —                       | Default workspace slug (avoids needing `-w` flag) |

## Development

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/mintplex-labs/anything-llm-cli.git
cd anything-llm-cli
bun run setup          # Install deps + create .env.local
bun run start prompt "Hello!"   # Run in development
bun run build          # Compile native binary → dist/any
```

## Uninstall

```bash
# If installed via install script
sudo rm /usr/local/bin/any

# If installed via package manager
npm uninstall -g @mintplex-labs/anything-llm-cli
```
