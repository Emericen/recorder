#!/bin/bash
set -e

echo "Installing Recorder..."

# Node (via nvm if not already installed)
if ! command -v node &>/dev/null; then
  if ! command -v nvm &>/dev/null; then
    echo "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  fi
  echo "Installing node..."
  nvm install node
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
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd "$HOME/.recorder"
npx electron-vite dev -- "$@" 2>/dev/null
LAUNCHER
chmod +x "$HOME/.local/bin/recorder"

# Add to PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
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
