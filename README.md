# Recorder

Screen + input recorder for observing knowledge worker workflows. Records coalesced user actions (clicks, typing, scrolling, hotkeys, drags) with screenshots and video. Output is a zip file on your Desktop.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/Emericen/recorder/main/install.sh | bash
```

Open a new terminal after install.

## Setup (first time)

```bash
record --grant-screen
```

```bash
record --grant-access
```

Grant each permission when macOS prompts you.

## Usage

```bash
record
```

```
Ctrl+C
```

Recording saves to your Desktop as a zip file.

## Development

```bash
npm install
npm run dev
```
