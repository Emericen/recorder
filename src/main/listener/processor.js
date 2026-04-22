import {
  MACOS_KEYCODE_TO_KEY,
  WINDOWS_RAWCODE_TO_KEY,
  WINDOWS_MODIFIER_RAWCODE_TO_KEY,
  SHIFT_KEY_MAP,
  ARROW_KEYS,
  SPECIAL_KEYS
} from "./constants.js"
import { screen } from "electron"
import { createRequire } from "module"

const require = createRequire(import.meta.url)

const iohookPromise =
  process.platform === "darwin"
    ? import("iohook-macos")
    : Promise.resolve(require("@tkomde/iohook"))

/**
 * Input Event Processor
 *
 * Processes raw iohook events into flat Action objects matching server contract.
 * Coalesces rapid actions (typing, clicks, scrolls) to reduce HTTP requests.
 *
 * Flat Action structure (all have id, type, timestamp, then type-specific fields):
 * - typing:       { text, screenshot }
 * - mouse_click:  { button, x, y, screenshot }
 * - mouse_drag:   { button, startX, startY, endX, endY, screenshot }
 * - scroll:       { x, y, screenshot }
 * - hotkey:       { modifiers[], key }
 * - special_key:  { key }
 * - autocomplete: { text }
 */

/**
 * Base class for input event processing
 * Converts raw iohook events into structured Action objects
 */
class ProcessorBase {
  /**
   * @param {Object} config
   * @param {number} [config.screenWidth=1920] - Screen width in pixels
   * @param {number} [config.screenHeight=1080] - Screen height in pixels
   * @param {number} [config.maxClickDistancePx=6] - Max distance for click vs drag
   * @param {number} [config.maxClickDurationMs=250] - Max duration for click vs drag
   * @param {number} [config.maxHistoryLength=5] - Max number of actions to keep in history
   * @param {number} [config.screenshotDelayMs=30] - Delay before capturing screenshot (for UI to update)
   * @param {Function} [config.captureScreenshot] - Screenshot capture callback
   * @param {Function} [config.onAction] - Called when action is emitted
   */
  constructor(config = {}) {
    this.screenWidth = config.screenWidth ?? 1920
    this.screenHeight = config.screenHeight ?? 1080

    this.currentActionId = 1
    this.textBuffer = ""
    this.activeModifiers = new Set()

    /** @type {Action[]} Array of all processed actions */
    this.actions = []

    this.pendingMouseDown = undefined
    this.lastCursorX = 0.5
    this.lastCursorY = 0.5

    this.maxClickDistancePx = config.maxClickDistancePx ?? 6
    this.maxClickDurationMs = config.maxClickDurationMs ?? 250
    this.coalesceWindowMs = config.coalesceWindowMs ?? 300
    this.maxHistoryLength = config.maxHistoryLength ?? 5
    this.screenshotDelayMs = config.screenshotDelayMs ?? 50

    this.captureScreenshot = config.captureScreenshot || null
    this.onAction = config.onAction || (() => {})
    this.showCrosshair = config.showCrosshair ?? false

    // Coalescing state
    this.lastActionType = null
    this.lastActionTimestamp = null
    this.lastActionButton = null
    this.lastActionKey = null

    // Pause state (to ignore events during autocomplete typing)
    this.paused = false
  }

  handleEvent(event, verbose = false) {
    throw new Error("handleEvent() must be implemented by subclass")
  }

  reset() {
    this.currentActionId = 1
    this.textBuffer = ""
    this.activeModifiers.clear()
    this.actions = []
    this.lastActionType = null
    this.lastActionTimestamp = null
    this.lastActionButton = null
    this.lastActionKey = null
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
  }

  flushTextBuffer() {
    this.textBuffer = ""
  }

  normalizePosition(x, y) {
    return {
      x: Math.min(Math.max(x / this.screenWidth, 0), 1),
      y: Math.min(Math.max(y / this.screenHeight, 0), 1)
    }
  }

  shouldCoalesce(action) {
    const timeDiff = action.timestamp - this.lastActionTimestamp
    if (!this.lastActionType || this.actions.length === 0) return false
    if (this.lastActionType !== action.type) return false

    if (action.type === "typing") return true
    if (timeDiff > this.coalesceWindowMs) return false
    if (action.type === "mouse_click")
      return this.lastActionButton === action.button
    if (action.type === "special_key") return this.lastActionKey === action.key
    if (action.type === "scroll") return true
    return false
  }

  updateCoalescingState(action) {
    this.lastActionType = action.type
    this.lastActionTimestamp = action.timestamp
    if (action.type === "mouse_click") this.lastActionButton = action.button
    else if (action.type === "special_key") this.lastActionKey = action.key
  }

  resetCoalescingState() {
    this.lastActionType = null
    this.lastActionTimestamp = null
    this.lastActionButton = null
    this.lastActionKey = null
  }

  async emitAction(partial) {
    const action = {
      id: `a${this.currentActionId++}`,
      type: partial.type,
      timestamp: partial.timestamp,
      ...partial.fields
    }

    // Wait for action to be reflected on screen before capturing
    if (this.screenshotDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.screenshotDelayMs))
    }

    if (this.captureScreenshot) {
      const screenshot = await this.captureScreenshot()
      if (screenshot) action.screenshot = screenshot
    }

    // Coalesce with last action if applicable
    if (this.shouldCoalesce(action)) {
      const lastAction = this.actions[this.actions.length - 1]
      if (action.type === "typing") {
        lastAction.text = action.text
      } else {
        lastAction.repeatCount = (lastAction.repeatCount || 1) + 1
      }
      // Always update screenshot and timestamp when coalescing
      if (action.screenshot) lastAction.screenshot = action.screenshot
      lastAction.timestamp = action.timestamp
      this.onAction(lastAction)
    } else {
      this.actions.push(action)
      if (this.actions.length > this.maxHistoryLength) this.actions.shift()
      this.onAction(action)
    }

    if (["mouse_drag", "hotkey"].includes(action.type)) {
      this.resetCoalescingState()
    } else {
      this.updateCoalescingState(action)
    }
  }

  handleMouseMove(event) {
    const pos = this.normalizePosition(event.x, event.y)
    this.lastCursorX = pos.x
    this.lastCursorY = pos.y
  }

  handleMouseDown(event, button) {
    this.flushTextBuffer()
    const pos = this.normalizePosition(event.x, event.y)
    this.lastCursorX = pos.x
    this.lastCursorY = pos.y
    this.pendingMouseDown = {
      timestamp: event.timestamp,
      button,
      x: pos.x,
      y: pos.y
    }
  }

  async handleMouseUp(event) {
    if (!this.pendingMouseDown) return

    const {
      button,
      x: downX,
      y: downY,
      timestamp: downTs
    } = this.pendingMouseDown
    const upPos = this.normalizePosition(event.x, event.y)
    const upTs = event.timestamp

    const dx = (upPos.x - downX) * this.screenWidth
    const dy = (upPos.y - downY) * this.screenHeight
    const ds = Math.sqrt(dx * dx + dy * dy)
    const dt = upTs - downTs

    if (ds <= this.maxClickDistancePx && dt <= this.maxClickDurationMs) {
      await this.emitAction({
        type: "mouse_click",
        timestamp: upTs,
        fields: {
          button,
          x: downX,
          y: downY,
          modifiers: Array.from(this.activeModifiers)
        }
      })
    } else {
      await this.emitAction({
        type: "mouse_drag",
        timestamp: upTs,
        fields: {
          button,
          startX: downX,
          startY: downY,
          endX: upPos.x,
          endY: upPos.y,
          modifiers: Array.from(this.activeModifiers)
        }
      })
    }

    this.pendingMouseDown = undefined
  }

  handleScroll(event) {
    this.flushTextBuffer()
    const pos = this.normalizePosition(event.x, event.y)
    this.emitAction({
      type: "scroll",
      timestamp: event.timestamp,
      fields: { x: pos.x, y: pos.y }
    })
  }

  handleSpecialKey(key, timestamp) {
    switch (key) {
      case "space":
        if (this.textBuffer.length > 0) {
          this.textBuffer += " "
          this.emitAction({
            type: "typing",
            timestamp,
            fields: { text: this.textBuffer }
          })
        } else {
          this.emitAction({
            type: "special_key",
            timestamp,
            fields: { key: "Space" }
          })
        }
        break
      case "backspace":
      case "delete":
        if (this.textBuffer.length > 0) {
          this.textBuffer = this.textBuffer.slice(0, -1)
          if (this.textBuffer.length > 0) {
            this.emitAction({
              type: "typing",
              timestamp,
              fields: { text: this.textBuffer }
            })
          }
        } else {
          this.emitAction({
            type: "special_key",
            timestamp,
            fields: { key: "Delete" }
          })
        }
        break
      case "return":
      case "enter":
        this.flushTextBuffer()
        this.emitAction({
          type: "special_key",
          timestamp,
          fields: { key: "Return" }
        })
        break
      case "tab":
        this.flushTextBuffer()
        this.emitAction({
          type: "special_key",
          timestamp,
          fields: { key: "Tab" }
        })
        break
      case "arrowup":
      case "up":
        this.flushTextBuffer()
        this.emitAction({
          type: "special_key",
          timestamp,
          fields: { key: "ArrowUp" }
        })
        break
      case "arrowdown":
      case "down":
        this.flushTextBuffer()
        this.emitAction({
          type: "special_key",
          timestamp,
          fields: { key: "ArrowDown" }
        })
        break
      case "arrowleft":
      case "left":
        this.flushTextBuffer()
        this.emitAction({
          type: "special_key",
          timestamp,
          fields: { key: "ArrowLeft" }
        })
        break
      case "arrowright":
      case "right":
        this.flushTextBuffer()
        this.emitAction({
          type: "special_key",
          timestamp,
          fields: { key: "ArrowRight" }
        })
        break
      default:
        if (key.length === 1) {
          this.textBuffer += key
          this.emitAction({
            type: "typing",
            timestamp,
            fields: { text: this.textBuffer }
          })
        } else if (key) {
          this.emitAction({ type: "special_key", timestamp, fields: { key } })
        }
    }
  }
}

export class MacOSProcessor extends ProcessorBase {
  handleEvent(event, verbose = false) {
    if (this.paused) return
    if (verbose) console.log(JSON.stringify(event, null, 2))

    const eventHandlers = {
      keyDown: this.handleKeyDown,
      flagsChanged: this.handleFlagsChanged,
      leftMouseDown: (e) => this.handleMouseDown(e, "left"),
      leftMouseUp: this.handleMouseUp,
      rightMouseDown: (e) => this.handleMouseDown(e, "right"),
      rightMouseUp: this.handleMouseUp,
      middleMouseDown: (e) => this.handleMouseDown(e, "middle"),
      middleMouseUp: this.handleMouseUp,
      scrollWheel: this.handleScroll,
      mouseMoved: this.handleMouseMove
    }

    const handler = eventHandlers[event.type]
    if (handler) handler.call(this, event)
  }

  handleKeyDown(event) {
    const baseKey = MACOS_KEYCODE_TO_KEY[event.keyCode] || String(event.keyCode)
    const hasShift = Boolean(event.modifiers?.shift)
    const hasNonShiftModifier = Array.from(this.activeModifiers).some(
      (mod) => mod !== "shift"
    )

    const isSpecialKey = SPECIAL_KEYS.includes(baseKey)
    const isArrowKey = ARROW_KEYS.includes(baseKey)

    // Emit hotkey if: non-shift modifier OR shift+arrow (for text selection)
    if (hasNonShiftModifier || (hasShift && isArrowKey)) {
      this.flushTextBuffer()
      const modifiers = Array.from(this.activeModifiers.values())
      this.emitAction({
        type: "hotkey",
        timestamp: event.timestamp,
        fields: { modifiers, key: baseKey }
      })
      return
    }

    // Only apply shift map to printable characters, not special keys
    const key =
      hasShift && !isSpecialKey
        ? SHIFT_KEY_MAP[baseKey] || baseKey.toUpperCase()
        : baseKey

    this.handleSpecialKey(key, event.timestamp)
  }

  handleFlagsChanged(event) {
    this.activeModifiers.clear()
    const modifiers = event.modifiers ?? {}
    for (const [key, value] of Object.entries(modifiers)) {
      if (value) this.activeModifiers.add(key)
    }
  }
}

export class WindowsProcessor extends ProcessorBase {
  handleEvent(event, verbose = false) {
    if (this.paused) return
    if (verbose) console.log(JSON.stringify(event, null, 2))

    const eventHandlers = {
      keydown: this.handleKeyDown,
      keyup: this.handleKeyUp,
      mousedown: this.handleMouseDownEvent,
      mouseup: this.handleMouseUpEvent,
      mousewheel: this.handleScroll
    }

    const handler = eventHandlers[event.type]
    if (handler) handler.call(this, event)
  }

  handleKeyDown(event) {
    this.updateModifiers(event)
    if (WINDOWS_MODIFIER_RAWCODE_TO_KEY[event.rawcode]) return
    const baseKey =
      WINDOWS_RAWCODE_TO_KEY[event.rawcode] || String(event.rawcode)
    const hasShift = Boolean(event.shiftKey)
    const hasNonShiftModifier = Array.from(this.activeModifiers).some(
      (mod) => mod !== "shift"
    )

    const isSpecialKey = SPECIAL_KEYS.includes(baseKey)
    const isArrowKey = ARROW_KEYS.includes(baseKey)

    // Emit hotkey if: non-shift modifier OR shift+arrow (for text selection)
    if (hasNonShiftModifier || (hasShift && isArrowKey)) {
      this.flushTextBuffer()
      const modifiers = Array.from(this.activeModifiers.values())
      this.emitAction({
        type: "hotkey",
        timestamp: event.timestamp,
        fields: { modifiers, key: baseKey }
      })
      return
    }

    // Only apply shift map to printable characters, not special keys
    const key =
      hasShift && !isSpecialKey
        ? SHIFT_KEY_MAP[baseKey] || baseKey.toUpperCase()
        : baseKey

    this.handleSpecialKey(key, event.timestamp)
  }

  handleKeyUp(event) {
    this.updateModifiers(event)
  }

  handleMouseDownEvent(event) {
    const buttonMap = { 1: "left", 2: "right", 3: "middle" }
    const button = buttonMap[event.button] || "left"
    this.handleMouseDown(event, button)
  }

  handleMouseUpEvent(event) {
    this.handleMouseUp(event)
  }

  updateModifiers(event) {
    this.activeModifiers.clear()
    if (event.shiftKey) this.activeModifiers.add("shift")
    if (event.ctrlKey) this.activeModifiers.add("control")
    if (event.altKey) this.activeModifiers.add("alt")
    if (event.metaKey) this.activeModifiers.add("command")
  }
}

/**
 * Create and start input processor
 * @param {Object} config
 * @param {Function} config.captureScreenshot - Screenshot callback
 * @param {Function} config.onAction - Called when action is emitted
 * @param {Function} config.onCapture - Called on double-tap Control
 * @param {Function} config.onPredict - Called on double-tap Option
 * @param {Function} [config.onRawEvent] - Called with raw iohook event (for recording/testing)
 * @returns {Promise<MacOSProcessor|WindowsProcessor>} The started processor instance
 */
export async function createProcessor(config = {}) {
  const { width, height } = screen.getPrimaryDisplay().bounds
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor


  const ProcessorClass =
    process.platform === "darwin" ? MacOSProcessor : WindowsProcessor

  const processor = new ProcessorClass({
    screenWidth: width,
    screenHeight: height,
    maxClickDistancePx: 6,
    maxClickDurationMs: 250,
    captureScreenshot: config.captureScreenshot,
    onAction: config.onAction
  })

  const iohookModule = await iohookPromise
  const iohook = iohookModule.default || iohookModule

  if (!iohook || typeof iohook.on !== "function") {
    throw new Error("Failed to load iohook")
  }

  // Generic event handler
  const handleEvent = (type) => (event) => {
    const timestampMs = Date.now()
    const enrichedEvent = { ...event, type, timestamp: timestampMs }
    if (config.onRawEvent) config.onRawEvent(enrichedEvent)
    if (processor) processor.handleEvent(enrichedEvent)
  }

  // Platform-specific setup
  if (process.platform === "darwin") {
    const permissions = iohook.checkAccessibilityPermissions()
    if (permissions.hasPermissions) {
      iohook.setVerboseLogging(false)
      iohook.enablePerformanceMode()
      iohook.startMonitoring()

      iohook.on("keyDown", handleEvent("keyDown"))
      iohook.on("keyUp", handleEvent("keyUp"))
      iohook.on("flagsChanged", handleEvent("flagsChanged"))
      iohook.on("leftMouseDown", handleEvent("leftMouseDown"))
      iohook.on("leftMouseUp", handleEvent("leftMouseUp"))
      iohook.on("rightMouseDown", handleEvent("rightMouseDown"))
      iohook.on("rightMouseUp", handleEvent("rightMouseUp"))
      iohook.on("middleMouseDown", handleEvent("middleMouseDown"))
      iohook.on("middleMouseUp", handleEvent("middleMouseUp"))
      iohook.on("scrollWheel", handleEvent("scrollWheel"))
      iohook.on("mouseMoved", handleEvent("mouseMoved"))
    } else {
      iohook.requestAccessibilityPermissions()
    }
  } else if (process.platform === "win32") {
    console.log("✅ Starting Windows input monitoring")
    iohook.start()

    iohook.on("keydown", handleEvent("keydown"))
    iohook.on("keyup", handleEvent("keyup"))
    iohook.on("mousedown", handleEvent("mousedown"))
    iohook.on("mouseup", handleEvent("mouseup"))
    iohook.on("mousewheel", handleEvent("mousewheel"))
  }

  return processor
}
