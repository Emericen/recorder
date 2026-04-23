import { ScreenCapture } from "./capture.js"

let screenCapture = null

window.api.on("vision", async (message) => {
  if (message.type === "source-id") {
    const { width, height } = window.screen
    screenCapture = new ScreenCapture(width, height)
    await screenCapture.startCapture(message.sourceId)
  }

  if (message.type === "request-frame" && screenCapture) {
    const frame = await screenCapture.captureFrame()
    window.api.send("vision", { type: "frame", data: frame })
  }

  if (message.type === "stop-capture" && screenCapture) {
    await screenCapture.stopCapture()
  }
})
