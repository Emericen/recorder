#!/bin/bash
set -e

echo "Installing Recorder..."

# Homebrew
if ! command -v brew &>/dev/null; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for Apple Silicon
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
  fi
fi

# Git
if ! command -v git &>/dev/null; then
  echo "Installing git..."
  brew install git
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

# Create launcher script
cat > /usr/local/bin/recorder << 'LAUNCHER'
#!/bin/bash
cd "$HOME/.recorder"
npx electron-vite dev -- "$@" 2>/dev/null
LAUNCHER
chmod +x /usr/local/bin/recorder

echo ""
echo "✅ Installed! Run 'recorder' to start, Ctrl+C to stop."
echo "   Recording saves to your Desktop as a zip file."
echo ""
