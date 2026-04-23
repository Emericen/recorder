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

# Setup permissions
echo ""
npx electron-vite dev -- --setup 2>/dev/null

echo ""
echo "✅ Installed! To record:"
echo "  cd ~/.recorder && npm run dev"
echo "  Ctrl+C to stop. Recording saves to Desktop."
echo ""
