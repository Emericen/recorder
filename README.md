# Recorder

Screen + input recorder for observing knowledge worker workflows. Records coalesced user actions (clicks, typing, scrolling, hotkeys, drags) with screenshots and video. Output is a zip file on your Desktop.

## Install

If you don't have Homebrew, install it first:

```bash
NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then install Recorder:

```bash
curl -fsSL https://raw.githubusercontent.com/Emericen/recorder/main/install.sh | bash
```

Open a new terminal after install.

## Usage

```bash
recorder
```

```
Ctrl+C
```

Recording saves to your Desktop as a zip file.

On first run, macOS will ask for **Screen Recording** and **Accessibility** permissions. Grant both and restart.

## Development

```bash
npm install
npm run dev
```
