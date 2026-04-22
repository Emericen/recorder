# Recorder

Screen + input recorder for observing knowledge worker workflows. Records coalesced user actions (clicks, typing, scrolling, hotkeys, drags) with screenshots and video. Output is a zip file on your Desktop.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/Emericen/recorder/main/install.sh | bash
```

## Usage

```bash
recorder        # start recording
Ctrl+C          # stop — zip appears on Desktop
```

On first run, macOS will ask for **Screen Recording** and **Accessibility** permissions. Grant both and restart.

## Output

`recording-<timestamp>.zip` on your Desktop containing:
- `actions.json` — raw action objects with base64 screenshots
- `meta.json` — session metadata
- `recording.webm` — video of the session

## Development

```bash
npm install
npm run dev     # Ctrl+C to stop
```
