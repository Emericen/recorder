/**
 * Session Recorder
 *
 * Streams actions and video to a folder on Desktop in real time.
 * Buffers the current coalescing action — only writes when finalized.
 */

import { mkdirSync, appendFileSync, writeFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"

export function createSessionRecorder() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, -5)

  const dir = join(homedir(), "Desktop", `recording-${timestamp}`)
  mkdirSync(dir, { recursive: true })

  const actionsPath = join(dir, "actions.jsonl")
  const videoPath = join(dir, "recording.webm")
  const metaPath = join(dir, "meta.json")

  const startTime = Date.now()
  let actionCount = 0
  let lastAction = null

  writeFileSync(metaPath, JSON.stringify({
    startTime: new Date(startTime).toISOString(),
    status: "recording"
  }, null, 2))

  function flush() {
    if (lastAction) {
      actionCount++
      appendFileSync(actionsPath, JSON.stringify(lastAction) + "\n")
      lastAction = null
    }
  }

  return {
    record(action) {
      // If same id as buffered action, it's a coalesce update — just replace buffer
      if (lastAction && lastAction.id === action.id) {
        lastAction = { ...action }
        return
      }
      // New action — flush previous, buffer this one
      flush()
      lastAction = { ...action }
    },

    appendVideo(chunk) {
      appendFileSync(videoPath, chunk)
    },

    get length() {
      return actionCount + (lastAction ? 1 : 0)
    },

    finalize() {
      flush()
      writeFileSync(metaPath, JSON.stringify({
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        actionCount,
        status: "complete"
      }, null, 2))
      console.log(`Saved: ${dir}`)
      return dir
    }
  }
}
