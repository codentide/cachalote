import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { rename, writeFile } from 'node:fs/promises'
import type { LiveProjectConfig } from '../../../shared/cachalote/live/live-types'
import { isLiveProjectConfig, isRecord } from './live-input-guards'
import type { ManifestEntry } from './live-sync'

/** Terminal handles are minted per process, so only the pane's identity is kept. */
export type PersistedTerminal = { worktreeId: string; tabId: string; ptyId: string | null }

export type PersistedLiveSlot = {
  /** Null once stopped; the manifest is kept so the next projection only copies the difference. */
  worktreeId: string | null
  manifest: Record<string, ManifestEntry>
  terminal: PersistedTerminal | null
  startedAt: number | null
}

export function liveSlotKey(repoId: string, slotId: string): string {
  return `${repoId}::${slotId}`
}

/** Slot ids never contain ':' so the last separator splits the key. */
export function parseLiveSlotKey(key: string): { repoId: string; slotId: string } | null {
  const index = key.lastIndexOf('::')
  return index > 0 ? { repoId: key.slice(0, index), slotId: key.slice(index + 2) } : null
}

const FILE_VERSION = 1
// Slot records carry a whole manifest, so editing sessions should not rewrite it every half second.
const DEFAULT_WRITE_DELAY_MS = 1_500

function isManifestEntry(value: unknown): value is ManifestEntry {
  return isRecord(value) && typeof value.id === 'string' && typeof value.mode === 'string'
}

function isPersistedTerminal(value: unknown): value is PersistedTerminal {
  return (
    isRecord(value) &&
    typeof value.worktreeId === 'string' &&
    typeof value.tabId === 'string' &&
    (value.ptyId === null || typeof value.ptyId === 'string')
  )
}

function parsePersistedSlot(value: unknown): PersistedLiveSlot | null {
  if (
    !isRecord(value) ||
    !(value.worktreeId === null || typeof value.worktreeId === 'string') ||
    !isRecord(value.manifest)
  ) {
    return null
  }
  const manifest: Record<string, ManifestEntry> = {}
  for (const [filePath, entry] of Object.entries(value.manifest)) {
    if (isManifestEntry(entry)) {
      manifest[filePath] = { id: entry.id, mode: entry.mode }
    }
  }
  return {
    worktreeId: value.worktreeId,
    manifest,
    terminal: isPersistedTerminal(value.terminal) ? value.terminal : null,
    startedAt: typeof value.startedAt === 'number' ? value.startedAt : null
  }
}

/** `cachalote-live.json`: per-project configs plus what each slot was serving. */
export class LiveConfigStore {
  private readonly configs = new Map<string, LiveProjectConfig>()
  private readonly slots = new Map<string, PersistedLiveSlot>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private writing: Promise<void> = Promise.resolve()
  private tempCounter = 0
  private dirty = false

  constructor(
    private readonly filePath: string,
    private readonly writeDelayMs = DEFAULT_WRITE_DELAY_MS
  ) {
    this.load()
  }

  private load(): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(this.filePath, 'utf8'))
    } catch {
      return
    }
    if (!isRecord(parsed) || parsed.version !== FILE_VERSION) {
      return
    }
    if (isRecord(parsed.configs)) {
      for (const [repoId, config] of Object.entries(parsed.configs)) {
        if (isLiveProjectConfig(config)) {
          this.configs.set(repoId, config)
        }
      }
    }
    if (isRecord(parsed.slots)) {
      for (const [key, slot] of Object.entries(parsed.slots)) {
        const persisted = parsePersistedSlot(slot)
        if (persisted) {
          this.slots.set(key, persisted)
        }
      }
    }
  }

  getConfig(repoId: string): LiveProjectConfig | null {
    return this.configs.get(repoId) ?? null
  }

  setConfig(config: LiveProjectConfig): void {
    this.configs.set(config.repoId, config)
    this.scheduleWrite()
  }

  deleteConfig(repoId: string): void {
    if (this.configs.delete(repoId)) {
      this.scheduleWrite()
    }
  }

  getSlot(key: string): PersistedLiveSlot | null {
    return this.slots.get(key) ?? null
  }

  slotKeys(): string[] {
    return [...this.slots.keys()]
  }

  setSlot(key: string, slot: PersistedLiveSlot): void {
    this.slots.set(key, slot)
    this.scheduleWrite()
  }

  deleteSlot(key: string): void {
    if (this.slots.delete(key)) {
      this.scheduleWrite()
    }
  }

  private serialize(): string {
    return JSON.stringify({
      version: FILE_VERSION,
      configs: Object.fromEntries(this.configs),
      slots: Object.fromEntries(this.slots)
    })
  }

  private scheduleWrite(): void {
    this.dirty = true
    if (this.timer) {
      return
    }
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, this.writeDelayMs)
    this.timer.unref?.()
  }

  /** Writes now (tmp file + rename); concurrent calls queue behind each other. */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.dirty = false
    const data = this.serialize()
    this.tempCounter += 1
    const temp = `${this.filePath}.${process.pid}-${this.tempCounter}.tmp`
    this.writing = this.writing
      .then(async () => {
        await writeFile(temp, data)
        await rename(temp, this.filePath)
      })
      .catch((error: unknown) => {
        console.warn('[cachalote-live] could not save state', error)
      })
    return this.writing
  }

  /** For app quit, where an async write would not finish. */
  flushSync(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (!this.dirty) {
      return
    }
    this.dirty = false
    try {
      const temp = `${this.filePath}.${process.pid}.tmp`
      writeFileSync(temp, this.serialize())
      renameSync(temp, this.filePath)
    } catch (error) {
      console.warn('[cachalote-live] could not save state', error)
    }
  }
}
