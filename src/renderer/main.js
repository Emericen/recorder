import { ScreenCapture } from "./capture.js"

let screenCapture = null

// Listen for IPC messages from main process
window.api.on("vision", async (message) => {
  if (message.type === "source-id") {
    // Initialize capture with screen source
    const { width, height } = window.screen
    screenCapture = new ScreenCapture(width, height)
    const ok = await screenCapture.startCapture(message.sourceId)
    if (ok) {
      console.log("✅ Renderer capture ready")
    } else {
      console.error("❌ Failed to start capture")
    }
  }

  if (message.type === "request-frame" && screenCapture) {
    const frame = await screenCapture.captureFrame()
    window.api.send("vision", { type: "frame", data: frame })
  }

  if (message.type === "stop-capture" && screenCapture) {
    const videoBuffer = await screenCapture.stopCapture()
    if (videoBuffer) {
      window.api.send("vision", {
        type: "recording",
        data: Array.from(new Uint8Array(videoBuffer))
      })
    } else {
      window.api.send("vision", { type: "recording", data: null })
    }
  }
})
