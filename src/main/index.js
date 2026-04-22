import { app, ipcMain, desktopCapturer } from "electron"
import { createCaptureWindow } from "./windows/capture.js"
import { createProcessor } from "./listener/processor.js"
import { createSessionRecorder } from "./recorder.js"
import { createRequire } from "module"

app.dock?.hide()

const isSetup = process.argv.includes("--setup")

let recording = false
let sessionRecorder = null
let captureScreenshot = null
let stopRecordingFn = null

async function setup() {
  console.log("Checking permissions...\n")

  // 1. Screen Recording
  let hasScreen = false
  try {
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } })
    hasScreen = sources.length > 0 && !sources[0].thumbnail.isEmpty()
  } catch {}
  console.log(hasScreen ? "✅ Screen Recording: granted" : "❌ Screen Recording: not granted — macOS will prompt on first recording")

  // 2. Accessibility
  let hasAccessibility = false
  try {
    const iohookModule = await import("iohook-macos")
    const iohook = iohookModule.default || iohookModule
    const result = iohook.checkAccessibilityPermissions()
    hasAccessibility = result.hasPermissions
    if (!hasAccessibility) iohook.requestAccessibilityPermissions()
  } catch {}
  console.log(hasAccessibility ? "✅ Accessibility: granted" : "❌ Accessibility: not granted — opening System Settings...")

  if (hasScreen && hasAccessibility) {
    console.log("\nAll permissions granted. Run 'recorder' to start.")
  } else {
    console.log("\nGrant the missing permissions, then run 'recorder --setup' again to verify.")
  }

  app.quit()
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

async function checkPermissions() {
  let hasScreen = false
  try {
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } })
    hasScreen = sources.length > 0 && !sources[0].thumbnail.isEmpty()
  } catch {}

  let hasAccessibility = false
  try {
    const iohookModule = await import("iohook-macos")
    const iohook = iohookModule.default || iohookModule
    hasAccessibility = iohook.checkAccessibilityPermissions().hasPermissions
  } catch {}

  return { hasScreen, hasAccessibility }
}

app.whenReady().then(async () => {
  if (isSetup) return setup()

  // Check permissions before recording
  if (process.platform === "darwin") {
    const { hasScreen, hasAccessibility } = await checkPermissions()
    if (!hasScreen || !hasAccessibility) {
      console.log("Missing permissions. Run 'recorder --setup' first.")
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
