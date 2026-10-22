import fs from 'node:fs'
import path from 'node:path'

// Chats whose conversation was handed back to a terminal: they own it no more and never start again.
// Upstream checks ownership inside the journal SQL worker thread, which shares no memory with main:
// the worker finds the file through the environment it inherits, and every reader revalidates its
// copy against the file's mtime, so a mark made in main reaches the worker.
const FILE_ENV = 'CACHALOTE_CEDED_CHATS_FILE'
let configuredFile: string | null = null
let cache: { file: string | null; mtimeMs: number; ceded: Set<string> } | null = null

/** Points the set at its file; until then it is empty and in memory only (tests, early boot). */
export function configureCachaloteCededChats(filePath: string): void {
  configuredFile = filePath
  // Workers spawned after this inherit it.
  process.env[FILE_ENV] = filePath
  cache = null
}

export const CACHALOTE_CEDED_CHATS_FILE_NAME = 'cachalote-ceded-chats.json'

function currentFile(): string | null {
  // Upstream exports the profile directory at startup, before any worker exists: the fallback that
  // does not depend on when the handoff handlers register.
  const userData = process.env.ORCA_USER_DATA_PATH
  return (
    configuredFile ??
    process.env[FILE_ENV] ??
    (userData ? path.join(userData, CACHALOTE_CEDED_CHATS_FILE_NAME) : null)
  )
}

function mtimeOf(file: string | null): number {
  return file ? (fs.statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? -1) : -1
}

function load(): Set<string> {
  const file = currentFile()
  const mtimeMs = mtimeOf(file)
  if (cache && cache.file === file && (!file || cache.mtimeMs === mtimeMs)) {
    return cache.ceded
  }
  const ceded = new Set<string>()
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
  cache = { file, mtimeMs, ceded }
  return ceded
}

function save(set: Set<string>): void {
  const file = currentFile()
  if (!file) {
    return
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(temp, JSON.stringify([...set]))
  fs.renameSync(temp, file)
  cache = { file, mtimeMs: mtimeOf(file), ceded: set }
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
