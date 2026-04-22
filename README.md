# Recorder

Screen + input recorder for observing knowledge worker workflows. Records coalesced user actions (clicks, typing, scrolling, hotkeys, drags) with screenshots and video. Output is a zip file on your Desktop ready for analysis.

## Install

Download the latest DMG from [Releases](https://github.com/Emericen/recorder/releases), open it, drag to Applications.

## Usage

1. Open Recorder — no window, just a system tray icon
2. Click tray icon → **Start Recording**
3. Do your work
4. Click tray icon → **Stop Recording**
5. A `recording-<timestamp>.zip` appears on your Desktop

The zip contains:
- `actions.json` — raw action objects with base64 screenshots
- `meta.json` — session metadata (start/end time, action count)
- `recording.webm` — video of the session

## Development

```bash
npm install
npm run dev
```

Requires macOS accessibility permissions (prompted on first run).

## Build

```bash
npm run package
```

Outputs a DMG in `dist/`.
