/**
 * Session Recorder
 *
 * Records raw action objects. Saves actions.json + recording.webm zipped to ~/Desktop/
 * Formatting is done in post-processing (notebook), not here.
 */

import { createWriteStream } from "fs"
import { join } from "path"
import { homedir } from "os"
import archiver from "archiver"

export function createSessionRecorder() {
  const actions = []
  const actionIndex = new Map()
  const startTime = Date.now()

  return {
    record(action) {
      const existingIdx = actionIndex.get(action.id)
      if (existingIdx !== undefined) {
        actions[existingIdx] = { ...action, recordedAt: Date.now() }
      } else {
        actionIndex.set(action.id, actions.length)
        actions.push({ ...action, recordedAt: Date.now() })
      }
    },

    get length() {
      return actions.length
    },

    async save(videoBuffer) {
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5)

      const desktop = join(homedir(), "Desktop")
      const zipPath = join(desktop, `recording-${timestamp}.zip`)

      const meta = {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        actionCount: actions.length
      }

      await new Promise((resolve, reject) => {
        const output = createWriteStream(zipPath)
        const archive = archiver("zip", { zlib: { level: 9 } })
        output.on("close", resolve)
        archive.on("error", reject)
        archive.pipe(output)

        archive.append(JSON.stringify(actions, null, 2), {
          name: "actions.json"
        })
        archive.append(JSON.stringify(meta, null, 2), { name: "meta.json" })

        if (videoBuffer) {
          archive.append(Buffer.from(videoBuffer), { name: "recording.webm" })
        }

        archive.finalize()
      })

      console.log(`Session saved to: ${zipPath}`)
      return zipPath
    }
  }
}
