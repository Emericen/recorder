import { app, ipcMain } from "electron"
import { createCaptureWindow } from "./windows/capture.js"
import { createProcessor } from "./listener/processor.js"
import { createSessionRecorder } from "./recorder.js"

app.dock?.hide()

let recording = false
let sessionRecorder = null
let captureScreenshot = null
let stopRecordingFn = null

async function start() {
  recording = true
  console.log("Recording started. Press Ctrl+C to stop.")

  const capture = await createCaptureWindow()
  captureScreenshot = capture.captureScreenshot
  stopRecordingFn = capture.stopRecording

  sessionRecorder = createSessionRecorder()

  await createProcessor({
    captureScreenshot,
    onAction: (action) => {
      if (recording && sessionRecorder) sessionRecorder.record(action)
    }
  })
}

async function stop() {
  if (!recording) return
  recording = false

  let videoBuffer = null
  try {
    if (stopRecordingFn) videoBuffer = await stopRecordingFn()
  } catch {}

  if (sessionRecorder && sessionRecorder.length > 0) {
    const path = await sessionRecorder.save(videoBuffer)
    console.log(`Saved: ${path}`)
  }

  app.quit()
}

app.whenReady().then(async () => {
  // Handle "Stop Sharing" from macOS system bar
  ipcMain.on("vision", (_event, message) => {
    if (message.type === "sharing-stopped" && recording) stop()
  })

  // Ctrl+C handler
  process.on("SIGINT", () => stop())

  await start()
})

app.on("window-all-closed", (e) => e.preventDefault())
