#!/bin/bash
set -e

# Require homebrew
if ! command -v brew &>/dev/null; then
  echo "Homebrew is required. Install it first:"
  echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  exit 1
fi

# Node
if ! command -v node &>/dev/null; then
  echo "Installing node..."
  brew install node
fi

# Clone or update
INSTALL_DIR="$HOME/.recorder"
if [ -d "$INSTALL_DIR" ]; then
  echo "Updating..."
  cd "$INSTALL_DIR" && git pull
else
  echo "Cloning..."
  git clone https://github.com/Emericen/recorder.git "$INSTALL_DIR"
fi

# Install dependencies
cd "$INSTALL_DIR"
npm install

# Create launcher in ~/.local/bin (no sudo needed)
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/recorder" << 'LAUNCHER'
#!/bin/bash
cd "$HOME/.recorder"
npx electron-vite dev -- "$@" 2>/dev/null
LAUNCHER
chmod +x "$HOME/.local/bin/recorder"

# Add to PATH if not already there
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
  export PATH="$HOME/.local/bin:$PATH"
fi

# Setup permissions
echo ""
recorder --setup

echo ""
echo "✅ Installed! Run 'recorder' to start, Ctrl+C to stop."
echo "   Recording saves to your Desktop as a zip file."
echo ""
