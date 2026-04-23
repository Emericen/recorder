import { app, ipcMain, desktopCapturer } from "electron"
import { createCaptureWindow } from "./windows/capture.js"
import { createProcessor } from "./listener/processor.js"
import { createSessionRecorder } from "./recorder.js"

app.dock?.hide()

const args = process.argv
const grantScreen = args.includes("--grant-screen")
const grantAccess = args.includes("--grant-access")

let recording = false
let sessionRecorder = null
let captureScreenshot = null
let stopRecordingFn = null

async function grantScreenRecording() {
  let granted = false
  try {
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } })
    granted = sources.length > 0 && !sources[0].thumbnail.isEmpty()
  } catch {}

  if (granted) {
    console.log("✅ Screen Recording: already granted")
  } else {
    console.log("Requesting Screen Recording permission...")
    try { await desktopCapturer.getSources({ types: ["screen"] }) } catch {}
    console.log("Grant the permission in the macOS dialog, then restart the app.")
  }
  app.quit()
}

async function grantAccessibility() {
  let granted = false
  try {
    const iohookModule = await import("iohook-macos")
    const iohook = iohookModule.default || iohookModule
    const result = iohook.checkAccessibilityPermissions()
    granted = result.hasPermissions
    if (!granted) iohook.requestAccessibilityPermissions()
  } catch {}

  if (granted) {
    console.log("✅ Accessibility: already granted")
  } else {
    console.log("Requesting Accessibility permission...")
    console.log("System Settings opened. Enable the toggle for this app.")
  }
  app.quit()
}

async function checkPermissions() {
  let hasScreen = false
  try {
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } })
    hasScreen = sources.length > 0 && !sources[0].thumbnail.isEmpty()
  } catch {}

  let hasAccess = false
  try {
    const iohookModule = await import("iohook-macos")
    const iohook = iohookModule.default || iohookModule
    hasAccess = iohook.checkAccessibilityPermissions().hasPermissions
  } catch {}

  return { hasScreen, hasAccess }
}

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
  if (grantScreen) return grantScreenRecording()
  if (grantAccess) return grantAccessibility()

  // Check permissions before recording
  if (process.platform === "darwin") {
    const { hasScreen, hasAccess } = await checkPermissions()
    if (!hasScreen) {
      console.log("Missing Screen Recording permission. Run: record --grant-screen")
      app.quit()
      return
    }
    if (!hasAccess) {
      console.log("Missing Accessibility permission. Run: record --grant-access")
      app.quit()
      return
    }
  }

  ipcMain.on("vision", (_event, message) => {
    if (message.type === "sharing-stopped" && recording) stop()
  })

  process.on("SIGINT", () => stop())

  await start()
})

app.on("window-all-closed", (e) => e.preventDefault())
