#!/bin/bash
set -e

echo "Installing Recorder..."

# Node — download prebuilt binary directly if not installed
if ! command -v node &>/dev/null; then
  echo "Installing node..."
  ARCH=$(uname -m)
  if [ "$ARCH" = "arm64" ]; then
    NODE_ARCH="arm64"
  else
    NODE_ARCH="x64"
  fi
  NODE_VERSION="v22.15.0"
  NODE_DIR="$HOME/.local/node"
  mkdir -p "$NODE_DIR"
  curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-darwin-${NODE_ARCH}.tar.gz" | tar -xz --strip-components=1 -C "$NODE_DIR"
  export PATH="$NODE_DIR/bin:$PATH"
  if ! grep -q '.local/node/bin' "$HOME/.zshrc" 2>/dev/null; then
    echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> "$HOME/.zshrc"
  fi
  echo "Node $(node --version) installed"
fi

# Download repo (no git needed)
INSTALL_DIR="$HOME/.recorder"
if [ -d "$INSTALL_DIR" ]; then
  echo "Updating..."
  rm -rf "$INSTALL_DIR"
fi
echo "Downloading..."
curl -fsSL https://github.com/Emericen/recorder/archive/refs/heads/main.tar.gz | tar -xz -C "$HOME"
mv "$HOME/recorder-main" "$INSTALL_DIR"

# Install dependencies
cd "$INSTALL_DIR"
npm install

# Create launcher
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/recorder" << 'LAUNCHER'
#!/bin/bash
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"
cd "$HOME/.recorder"
npx electron-vite dev -- "$@" 2>/dev/null
LAUNCHER
chmod +x "$HOME/.local/bin/recorder"

# Add to PATH
if ! grep -q '.local/bin' "$HOME/.zshrc" 2>/dev/null; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
fi
export PATH="$HOME/.local/bin:$PATH"

# Setup permissions
echo ""
"$HOME/.local/bin/recorder" --setup

echo ""
echo "✅ Installed!"
echo ""
echo "Open a new terminal, then run:"
echo "  recorder          # start recording"
echo "  Ctrl+C            # stop, saves zip to Desktop"
echo ""
