#!/bin/bash
set -e

echo "Installing Recorder..."

# Homebrew
if ! command -v brew &>/dev/null; then
  echo "Installing Homebrew..."
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
  fi
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

# Create launcher
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/recorder" << 'LAUNCHER'
#!/bin/bash
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
