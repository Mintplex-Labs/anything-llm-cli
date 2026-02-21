#!/bin/sh
set -e

REPO="Mintplex-Labs/anything-llm-cli"
INSTALL_DIR="$HOME/.local/bin"
BINARY_NAME="any"

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Linux)  OS="linux" ;;
  Darwin) OS="darwin" ;;
  *)      echo "Unsupported OS: $OS" && exit 1 ;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)       echo "Unsupported architecture: $ARCH" && exit 1 ;;
esac

ASSET="any-${OS}-${ARCH}"
echo "Detected platform: ${OS}-${ARCH}"

# Ensure ~/.local/bin exists
if [ ! -d "$INSTALL_DIR" ]; then
  echo "Creating ${INSTALL_DIR}..."
  mkdir -p "$INSTALL_DIR"
fi

# Ensure ~/.local/bin is on PATH
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    SHELL_NAME="$(basename "$SHELL")"
    case "$SHELL_NAME" in
      zsh)  SHELL_RC="$HOME/.zshrc" ;;
      bash)
        # Prefer .bashrc, fall back to .bash_profile
        if [ -f "$HOME/.bashrc" ]; then
          SHELL_RC="$HOME/.bashrc"
        else
          SHELL_RC="$HOME/.bash_profile"
        fi
        ;;
      fish) SHELL_RC="$HOME/.config/fish/config.fish" ;;
      *)    SHELL_RC="$HOME/.profile" ;;
    esac

    if [ "$SHELL_NAME" = "fish" ]; then
      PATH_LINE="fish_add_path $INSTALL_DIR"
    else
      PATH_LINE="export PATH=\"\$HOME/.local/bin:\$PATH\""
    fi

    echo "Adding ${INSTALL_DIR} to PATH in ${SHELL_RC}..."
    echo "" >> "$SHELL_RC"
    echo "# Added by AnythingLLM CLI installer" >> "$SHELL_RC"
    echo "$PATH_LINE" >> "$SHELL_RC"
    NEED_RELOAD=1
    ;;
esac

# Get latest release download URL
DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"

echo "Downloading ${ASSET}..."
curl -fSL "$DOWNLOAD_URL" -o "$BINARY_NAME"
chmod +x "$BINARY_NAME"

echo "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."
mv "$BINARY_NAME" "${INSTALL_DIR}/${BINARY_NAME}"

echo "Installed successfully! Run 'any --help' to get started."
if [ "${NEED_RELOAD:-}" = "1" ]; then
  echo "NOTE: Restart your shell or run 'source ${SHELL_RC}' for PATH changes to take effect."
fi
