#!/bin/sh
set -e

REPO="Mintplex-Labs/anything-llm-cli"
INSTALL_DIR="/usr/local/bin"
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

# Get latest release download URL
DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"

echo "Downloading ${ASSET}..."
curl -fSL "$DOWNLOAD_URL" -o "$BINARY_NAME"
chmod +x "$BINARY_NAME"

echo "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."
if [ -w "$INSTALL_DIR" ]; then
  mv "$BINARY_NAME" "${INSTALL_DIR}/${BINARY_NAME}"
else
  sudo mv "$BINARY_NAME" "${INSTALL_DIR}/${BINARY_NAME}"
fi

echo "Installed successfully! Run 'any --help' to get started."
