import fs from 'node:fs'
import path from 'node:path'

// Chats whose conversation was handed back to a terminal: they own it no more and never start again.
let file: string | null = null
let ceded: Set<string> | null = null

/** Points the set at its file; until then it is empty and in memory only (tests, early boot). */
export function configureCachaloteCededChats(filePath: string): void {
  file = filePath
  ceded = null
}

function load(): Set<string> {
  if (ceded) {
    return ceded
  }
  ceded = new Set()
  if (file) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (typeof id === 'string') {
            ceded.add(id)
          }
        }
      }
    } catch {
      // Missing or unreadable: nothing was ceded.
    }
  }
  return ceded
}

function save(set: Set<string>): void {
  if (!file) {
    return
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(temp, JSON.stringify([...set]))
  fs.renameSync(temp, file)
}

export function isCachaloteCededChat(sessionId: string): boolean {
  return load().has(sessionId)
}

export function markCachaloteCededChat(sessionId: string): void {
  const set = load()
  set.add(sessionId)
  save(set)
}

export function unmarkCachaloteCededChat(sessionId: string): void {
  const set = load()
  if (set.delete(sessionId)) {
    save(set)
  }
}
