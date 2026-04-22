import { app, Tray, Menu, nativeImage, ipcMain } from "electron"
import { createCaptureWindow } from "./windows/capture.js"
import { createProcessor } from "./listener/processor.js"
import { createSessionRecorder } from "./recorder.js"

app.dock?.hide()

let tray = null
let recording = false
let processor = null
let sessionRecorder = null
let captureScreenshot = null
let stopRecording = null

function updateTrayMenu() {
  if (!tray) return
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: recording ? "⏹ Stop Recording" : "⏺ Start Recording",
        click: () => (recording ? stop() : start())
      },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() }
    ])
  )
  tray.setToolTip(recording ? "Recording..." : "Recorder")
}

async function start() {
  if (recording) return
  recording = true
  updateTrayMenu()

  console.log("🔴 Recording started")

  // Create capture window for screenshots
  const capture = await createCaptureWindow()
  captureScreenshot = capture.captureScreenshot
  stopRecording = capture.stopRecording

  // Create session recorder
  sessionRecorder = createSessionRecorder()

  // Create input processor with coalescing
  processor = await createProcessor({
    captureScreenshot,
    onAction: (action) => {
      if (recording && sessionRecorder) sessionRecorder.record(action)
    }
  })
}

async function stop() {
  if (!recording) return
  recording = false
  updateTrayMenu()

  console.log("⏹ Recording stopped")

  let videoBuffer = null
  try {
    if (stopRecording) videoBuffer = await stopRecording()
  } catch {}

  // Save session
  if (sessionRecorder && sessionRecorder.length > 0) {
    const path = await sessionRecorder.save(videoBuffer)
    console.log(`✅ Saved: ${path}`)
  } else {
    console.log("⚠️  No actions recorded")
  }

  // Reset
  processor = null
  sessionRecorder = null
  captureScreenshot = null
  stopRecording = null
}

app.whenReady().then(() => {
  // White square tray icon (same as OpenMNK)
  const size = 32
  const rgba = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const offset = i * 4
    rgba[offset] = 255
    rgba[offset + 1] = 255
    rgba[offset + 2] = 255
    rgba[offset + 3] = 255
  }
  const icon = nativeImage
    .createFromBitmap(rgba, { width: size, height: size, scaleFactor: 1 })
    .resize({ width: 22, height: 22 })

  tray = new Tray(icon)
  updateTrayMenu()

  // Handle "Stop Sharing" from macOS system bar
  ipcMain.on("vision", (_event, message) => {
    if (message.type === "sharing-stopped" && recording) {
      console.log("Screen sharing stopped by user, saving...")
      stop()
    }
  })
})

app.on("window-all-closed", (e) => {
  e.preventDefault() // keep running with just tray
})

app.on("before-quit", async (e) => {
  if (recording) {
    e.preventDefault()
    await stop()
    app.quit()
  }
})
