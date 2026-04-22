import { app, Tray, Menu, nativeImage, ipcMain, dialog, desktopCapturer, systemPreferences } from "electron"
import { createCaptureWindow } from "./windows/capture.js"
import { createProcessor } from "./listener/processor.js"
import { createSessionRecorder } from "./recorder.js"
import { createRequire } from "module"

app.dock?.hide()

let tray = null
let recording = false
let processor = null
let sessionRecorder = null
let captureScreenshot = null
let stopRecording = null

async function checkPermissions() {
  const missing = []

  // Check screen recording — try to get sources, if it fails or returns no usable sources, permission is missing
  try {
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } })
    const hasScreenPermission = sources.length > 0 && !sources[0].thumbnail.isEmpty()
    if (!hasScreenPermission) missing.push("Screen Recording")
  } catch {
    missing.push("Screen Recording")
  }

  // Check accessibility (iohook needs this)
  try {
    const require = createRequire(import.meta.url)
    const iohookModule = await import("iohook-macos")
    const iohook = iohookModule.default || iohookModule
    const result = iohook.checkAccessibilityPermissions()
    if (!result.hasPermissions) missing.push("Accessibility")
  } catch {
    missing.push("Accessibility")
  }

  return missing
}

async function promptPermissions(missing) {
  const list = missing.join(" and ")
  const { response } = await dialog.showMessageBox({
    type: "warning",
    title: "Permissions Required",
    message: `Recorder needs ${list} permissions to work.`,
    detail: `Go to System Settings → Privacy & Security → ${missing[0]}, and enable Recorder. Then restart the app.`,
    buttons: ["Open System Settings", "Quit"],
    defaultId: 0
  })

  if (response === 0) {
    // Open the relevant settings pane
    const { shell } = await import("electron")
    if (missing.includes("Screen Recording")) {
      shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
    } else if (missing.includes("Accessibility")) {
      shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
    }
  }

  app.quit()
}

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

  console.log("Recording started")

  const capture = await createCaptureWindow()
  captureScreenshot = capture.captureScreenshot
  stopRecording = capture.stopRecording

  sessionRecorder = createSessionRecorder()

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

  console.log("Recording stopped")

  let videoBuffer = null
  try {
    if (stopRecording) videoBuffer = await stopRecording()
  } catch {}

  if (sessionRecorder && sessionRecorder.length > 0) {
    const path = await sessionRecorder.save(videoBuffer)
    console.log(`Saved: ${path}`)
  }

  processor = null
  sessionRecorder = null
  captureScreenshot = null
  stopRecording = null
}

app.whenReady().then(async () => {
  // Check permissions before anything else
  if (process.platform === "darwin") {
    const missing = await checkPermissions()
    if (missing.length > 0) {
      app.dock?.show() // show dock briefly so dialog is visible
      await promptPermissions(missing)
      return
    }
  }

  // White square tray icon
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

  ipcMain.on("vision", (_event, message) => {
    if (message.type === "sharing-stopped" && recording) {
      console.log("Screen sharing stopped by user, saving...")
      stop()
    }
  })
})

app.on("window-all-closed", (e) => {
  e.preventDefault()
})

app.on("before-quit", async (e) => {
  if (recording) {
    e.preventDefault()
    await stop()
    app.quit()
  }
})
