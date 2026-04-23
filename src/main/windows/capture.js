import { BrowserWindow, ipcMain, desktopCapturer } from "electron"
import { join } from "path"
import { is } from "@electron-toolkit/utils"

let captureWindow = null

/**
 * Send a request to renderer and wait for a specific response type.
 * This is the only way to do main→renderer request/response in Electron.
 */
function requestFromRenderer(type, payload = {}, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!captureWindow || captureWindow.isDestroyed()) return resolve(null)

    const timeout = setTimeout(() => {
      ipcMain.removeListener("vision", handler)
      timeoutMs > 10000 ? resolve(null) : reject(new Error(`${type} timeout`))
    }, timeoutMs)

    const handler = (_event, message) => {
      if (message.type === type) {
        clearTimeout(timeout)
        ipcMain.removeListener("vision", handler)
        resolve(message.data)
      }
    }

    ipcMain.on("vision", handler)
    captureWindow.webContents.send("vision", payload)
  })
}

export async function createCaptureWindow() {
  captureWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      offscreen: false
    }
  })

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    captureWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    captureWindow.loadFile(join(__dirname, "../../renderer/index.html"))
  }

  // Wait for window to load, then send screen source ID to renderer
  await new Promise((resolve) => {
    captureWindow.once("ready-to-show", async () => {
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 0, height: 0 }
      })
      captureWindow.webContents.send("vision", {
        type: "source-id",
        sourceId: sources[0].id
      })
      resolve()
    })
  })

  captureWindow.once("closed", () => {
    captureWindow = null
  })

  const captureScreenshot = async () => {
    try {
      return await requestFromRenderer("frame", { type: "request-frame" }, 5000)
    } catch {
      return null
    }
  }

  const stopCapture = async () => {
    try {
      captureWindow?.webContents.send("vision", { type: "stop-capture" })
    } catch {}
  }

  return { window: captureWindow, captureScreenshot, stopCapture }
}
