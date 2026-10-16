import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { subscribeViaWatcherProcess } from '../../ipc/filesystem/watcher-process/parcel-watcher-process'

// Upstream keeps these types module-private; derive them from the signature Sonar depends on.
type WatcherProcessCallback = Parameters<typeof subscribeViaWatcherProcess>[1]
type WatcherProcessHooks = NonNullable<Parameters<typeof subscribeViaWatcherProcess>[3]>
import { watchWorktree, WATCH_DEBOUNCE_MS, type WatchedEvents } from './live-watch'

const ROOT = '/work/tree'

function harness() {
  let deliver: WatcherProcessCallback = () => {}
  let hooks: WatcherProcessHooks = {}
  let subscribedOptions: unknown = null
  const unsubscribe = vi.fn(async () => {})
  const subscribe = vi.fn(async (_dir, callback, options, subscribeHooks = {}) => {
    deliver = callback
    hooks = subscribeHooks
    subscribedOptions = options
    return { unsubscribe }
  })
  const batches: WatchedEvents[] = []
  const onResync = vi.fn()
  return {
    subscribe,
    unsubscribe,
    batches,
    onResync,
    deliver: (...args: Parameters<WatcherProcessCallback>) => deliver(...args),
    hooks: () => hooks,
    options: () => subscribedOptions,
    start: () =>
      watchWorktree(ROOT, { onEvents: (events) => batches.push(events), onResync }, subscribe)
  }
}

describe('watchWorktree', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('subscribes through the watcher process with the shared ignore list and directory metadata', async () => {
    const h = harness()
    await h.start()

    expect(h.subscribe).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(h.options())).toContain('node_modules')
    expect(h.hooks().delivery).toEqual({ includeDirectoryMetadata: true })
  })

  it('debounces events into one repo-relative batch and ignores .git', async () => {
    const h = harness()
    await h.start()

    h.deliver(null, [
      { type: 'update', path: `${ROOT}/src/a.ts` },
      { type: 'update', path: `${ROOT}/src/a.ts` },
      { type: 'delete', path: `${ROOT}/old.ts` },
      { type: 'create', path: `${ROOT}/newdir`, isDirectory: true },
      { type: 'update', path: `${ROOT}/.git/index` },
      { type: 'update', path: '/somewhere/else.ts' }
    ])
    expect(h.batches).toEqual([])
    await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS)

    expect(h.batches).toEqual([
      new Map([
        ['src/a.ts', 'change'],
        ['old.ts', 'delete'],
        ['newdir', 'directory']
      ])
    ])
  })

  it('asks for a full sync on overflow, interruption and watcher errors', async () => {
    const h = harness()
    await h.start()

    h.hooks().onOverflow?.()
    h.hooks().onInterruption?.()
    h.deliver(new Error('boom'), [])

    expect(h.onResync).toHaveBeenCalledTimes(3)
  })

  it('goes quiet after stop and unsubscribes', async () => {
    const h = harness()
    const handle = await h.start()
    h.deliver(null, [{ type: 'update', path: `${ROOT}/a.ts` }])

    await handle.stop()
    await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS * 2)
    h.deliver(null, [{ type: 'update', path: `${ROOT}/b.ts` }])
    await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS * 2)

    expect(h.batches).toEqual([])
    expect(h.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
