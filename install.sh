#!/bin/bash
set -e

# Resolve real user when running under sudo
REAL_USER="${SUDO_USER:-$USER}"
REAL_HOME=$(eval echo "~$REAL_USER")

echo "Installing Recorder for $REAL_USER..."

# Homebrew
if ! command -v brew &>/dev/null; then
  echo "Installing Homebrew..."
  sudo -u "$REAL_USER" /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for Apple Silicon
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    sudo -u "$REAL_USER" bash -c 'echo "eval \"\$(/opt/homebrew/bin/brew shellenv)\"" >> ~/.zprofile'
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

# Clone or update as real user
INSTALL_DIR="$REAL_HOME/.recorder"
if [ -d "$INSTALL_DIR" ]; then
  echo "Updating..."
  sudo -u "$REAL_USER" git -C "$INSTALL_DIR" pull
else
  echo "Cloning..."
  sudo -u "$REAL_USER" git clone https://github.com/Emericen/recorder.git "$INSTALL_DIR"
fi

# Install dependencies as real user
cd "$INSTALL_DIR"
sudo -u "$REAL_USER" npm install

# Create launcher script
cat > /usr/local/bin/recorder << LAUNCHER
#!/bin/bash
cd "$REAL_HOME/.recorder"
npx electron-vite dev -- "\$@" 2>/dev/null
LAUNCHER
chmod +x /usr/local/bin/recorder

echo ""
echo "✅ Installed! Setting up permissions..."
echo ""
sudo -u "$REAL_USER" recorder --setup

echo ""
echo "Run 'recorder' to start, Ctrl+C to stop."
echo "Recording saves to your Desktop as a zip file."
echo ""
