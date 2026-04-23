/**
 * Screen Capture Manager
 *
 * ⚠️ RENDERER PROCESS ONLY ⚠️
 * This class uses browser APIs (navigator.mediaDevices, video element, canvas)
 * and can ONLY be instantiated in the renderer process.
 *
 * Main process should:
 * 1. Use desktopCapturer.getSources() to get source IDs
 * 2. Send source ID to renderer via IPC
 * 3. Renderer instantiates this class with the source ID
 * 4. Communicate with renderer via IPC for screenshot requests
 *
 * Handles continuous screen recording and frame extraction for action screenshots.
 * Uses video element + canvas approach for reliable cross-platform frame capture.
 */
export class ScreenCapture {
  constructor(screenWidth, screenHeight) {
    this.stream = null
    this.isCapturing = false
    this.screenWidth = screenWidth
    this.screenHeight = screenHeight
    this.videoElement = null
    this.canvas = null
    this.canvasContext = null
    this.mediaRecorder = null
  }

  /**
   * Start capturing the screen with a given source ID
   * @param {string} sourceId - Desktop capturer source ID from main process
   * @returns {Promise<boolean>} True if capture started successfully
   */
  async startCapture(sourceId) {
    if (this.isCapturing) {
      console.warn("Screenshot capture already active")
      return true
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sourceId,
            minWidth: this.screenWidth,
            maxWidth: this.screenWidth,
            minHeight: this.screenHeight,
            maxHeight: this.screenHeight
          }
        }
      })

      const videoTrack = this.stream.getVideoTracks()[0]
      if (!videoTrack) {
        console.error("Failed to start screenshot capture: no video track")
        return false
      }

      // Handle "Stop Sharing" from macOS system bar
      videoTrack.onended = () => {
        console.log("Screen sharing stopped by user")
        window.api.send("vision", { type: "sharing-stopped" })
      }

      // Create hidden video element to play the stream
      this.videoElement = document.createElement("video")
      this.videoElement.srcObject = this.stream
      this.videoElement.style.position = "absolute"
      this.videoElement.style.top = "-9999px"
      this.videoElement.style.left = "-9999px"
      this.videoElement.style.pointerEvents = "none"
      this.videoElement.width = this.screenWidth
      this.videoElement.height = this.screenHeight
      this.videoElement.autoplay = true
      this.videoElement.muted = true
      document.body.appendChild(this.videoElement)

      // Create canvas for frame capture
      this.canvas = document.createElement("canvas")
      this.canvas.width = this.screenWidth
      this.canvas.height = this.screenHeight
      this.canvasContext = this.canvas.getContext("2d")

      // Wait for video to be ready
      await new Promise((resolve) => {
        if (this.videoElement.readyState >= 2) {
          resolve()
        } else {
          this.videoElement.onloadeddata = resolve
        }
      })

      // Start WebM recording — stream chunks to main process in real time
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: "video/webm"
      })
      this.mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const buffer = await e.data.arrayBuffer()
          window.api.send("vision", {
            type: "video-chunk",
            data: Array.from(new Uint8Array(buffer))
          })
        }
      }
      this.mediaRecorder.start(1000)

      this.isCapturing = true
      console.log("✅ Screenshot capture + WebM recording started")
      return true
    } catch (error) {
      console.error("Failed to start screenshot capture:", error)
      return false
    }
  }

  /**
   * Stop capturing — video already streamed to disk via chunks
   */
  async stopCapture() {
    if (!this.isCapturing) return

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
    }
    this.mediaRecorder = null

    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null

    if (this.videoElement) {
      this.videoElement.srcObject = null
      this.videoElement.remove()
      this.videoElement = null
    }

    this.canvas = null
    this.canvasContext = null
    this.isCapturing = false
    return videoBuffer
  }

  /**
   * Capture a clean frame from the video stream (no annotations)
   * @returns {Promise<string|null>} Base64 JPEG data URL
   */
  async captureFrame() {
    if (!this.videoElement || !this.canvas || !this.canvasContext) return null
    if (this.videoElement.readyState < 2) return null

    try {
      this.canvasContext.drawImage(this.videoElement, 0, 0, this.screenWidth, this.screenHeight)
      return this.canvas.toDataURL("image/jpeg", 0.9)
    } catch {
      return null
    }
  }
}
