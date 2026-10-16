import { realpath } from 'node:fs/promises'
import path from 'node:path'
import {
  buildParcelWatcherIgnoreOptions,
  WATCHER_IGNORE_DIRS
} from '../../ipc/filesystem/watchers/filesystem-watcher-ignore'
import { subscribeViaWatcherProcess } from '../../ipc/filesystem/watcher-process/parcel-watcher-process'

/** `directory` marks a created or changed directory: only a full enumeration knows what is inside. */
export type WatchEventKind = 'change' | 'delete' | 'directory'
export type WatchedEvents = Map<string, WatchEventKind>

export type LiveWatchCallbacks = {
  /** Debounced, repo-relative. */
  onEvents: (events: WatchedEvents) => void
  /** The watcher lost events (overflow, interruption, error); a full sync must follow. */
  onResync: () => void
}

export type LiveWatchHandle = { stop: () => Promise<void> }

export const WATCH_DEBOUNCE_MS = 150

function relativeToRoots(roots: readonly string[], absolute: string): string | null {
  for (const root of roots) {
    const relative = path.relative(root, absolute)
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
      return relative.split(path.sep).join('/')
    }
  }
  return null
}

/** Watches one worktree through the isolated watcher process; only the served worktree is watched. */
export async function watchWorktree(
  worktreePath: string,
  callbacks: LiveWatchCallbacks,
  subscribe: typeof subscribeViaWatcherProcess = subscribeViaWatcherProcess
): Promise<LiveWatchHandle> {
  const resolvedRoot = await realpath(worktreePath).catch(() => worktreePath)
  const roots = resolvedRoot === worktreePath ? [worktreePath] : [worktreePath, resolvedRoot]
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let buffered: WatchedEvents = new Map()

  const flush = (): void => {
    timer = null
    if (stopped || buffered.size === 0) {
      return
    }
    const events = buffered
    buffered = new Map()
    callbacks.onEvents(events)
  }

  const subscription = await subscribe(
    worktreePath,
    (error, events) => {
      if (stopped) {
        return
      }
      if (error) {
        callbacks.onResync()
        return
      }
      for (const event of events) {
        const relative = relativeToRoots(roots, event.path)
        if (!relative || relative === '.git' || relative.startsWith('.git/')) {
          continue
        }
        const kind: WatchEventKind =
          event.type === 'delete' ? 'delete' : event.isDirectory ? 'directory' : 'change'
        buffered.set(relative, kind)
      }
      if (buffered.size > 0 && !timer) {
        timer = setTimeout(flush, WATCH_DEBOUNCE_MS)
        timer.unref?.()
      }
    },
    buildParcelWatcherIgnoreOptions(WATCHER_IGNORE_DIRS),
    {
      delivery: { includeDirectoryMetadata: true },
      onOverflow: () => {
        if (!stopped) {
          callbacks.onResync()
        }
      },
      onInterruption: () => {
        if (!stopped) {
          callbacks.onResync()
        }
      }
    }
  )

  return {
    stop: async () => {
      stopped = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      buffered = new Map()
      await subscription.unsubscribe().catch(() => undefined)
    }
  }
}
