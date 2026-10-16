import type { WatchedEvents } from './live-watch'

// More paths than this in one tick costs more to check one by one than to enumerate once.
const FULL_SYNC_THRESHOLD = 300

/** Watcher events gathered while a slot's queue is busy; one pass drains them all. */
export class PendingDelta {
  full = false
  private readonly deleted = new Set<string>()
  private readonly changed = new Set<string>()

  add(events: WatchedEvents): void {
    for (const [relativePath, kind] of events) {
      if (kind === 'delete') {
        this.deleted.add(relativePath)
        this.changed.delete(relativePath)
      } else if (kind === 'directory') {
        this.full = true
      } else {
        this.changed.add(relativePath)
        this.deleted.delete(relativePath)
      }
    }
    if (this.deleted.size + this.changed.size > FULL_SYNC_THRESHOLD) {
      this.full = true
    }
  }

  requireFullSync(): void {
    this.full = true
  }

  paths(): { deleted: string[]; changed: string[] } {
    return { deleted: [...this.deleted], changed: [...this.changed] }
  }
}
