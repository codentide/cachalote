import { describe, expect, it } from 'vitest'
import { LiveSlotQueue } from './live-slot-queue'

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('LiveSlotQueue', () => {
  it('never runs two operations at once, in order', async () => {
    const queue = new LiveSlotQueue()
    const log: string[] = []
    const gate = deferred()
    const first = queue.enqueue('first', async () => {
      log.push('first:start')
      await gate.promise
      log.push('first:end')
    })
    const second = queue.enqueue('second', async () => {
      log.push('second')
    })

    await Promise.resolve()
    expect(log).toEqual(['first:start'])
    gate.resolve()
    await Promise.all([first, second])

    expect(log).toEqual(['first:start', 'first:end', 'second'])
  })

  it('collapses queued deltas into one pass over the accumulated paths', async () => {
    const queue = new LiveSlotQueue()
    const gate = deferred()
    const accumulated = new Set<string>()
    const passes: string[][] = []
    const run = async (): Promise<void> => {
      passes.push([...accumulated])
      accumulated.clear()
    }
    const busy = queue.enqueue('project', () => gate.promise)

    accumulated.add('a')
    expect(queue.enqueueCoalesced('delta', run)).toBe(true)
    accumulated.add('b')
    expect(queue.enqueueCoalesced('delta', run)).toBe(false)
    accumulated.add('c')
    expect(queue.enqueueCoalesced('delta', run)).toBe(false)
    gate.resolve()
    await busy
    await queue.enqueue('barrier', async () => {})

    expect(passes).toEqual([['a', 'b', 'c']])
  })

  it('queues a fresh delta when one is already running', async () => {
    const queue = new LiveSlotQueue()
    const gate = deferred()
    const log: string[] = []
    queue.enqueueCoalesced('delta', async () => {
      log.push('one:start')
      await gate.promise
    })
    await Promise.resolve()

    expect(queue.enqueueCoalesced('delta', async () => void log.push('two'))).toBe(true)
    gate.resolve()
    await queue.enqueue('barrier', async () => {})

    expect(log).toEqual(['one:start', 'two'])
  })

  it('lets a newer project drop what the previous one still had queued', async () => {
    const queue = new LiveSlotQueue()
    const gate = deferred()
    const log: string[] = []
    const running = queue.enqueue('project', async () => {
      log.push('project A')
      await gate.promise
    })
    const staleProject = queue.enqueue('project', async () => void log.push('project B'))
    queue.enqueueCoalesced('delta', async () => void log.push('delta'))
    const newest = queue.enqueue('project', async () => void log.push('project C'), {
      supersede: true
    })

    gate.resolve()
    expect(await staleProject).toBe(false)
    expect(await running).toBe(true)
    expect(await newest).toBe(true)
    expect(log).toEqual(['project A', 'project C'])
  })

  it('keeps draining after an operation fails', async () => {
    const queue = new LiveSlotQueue()
    const failing = queue.enqueue('bad', async () => {
      throw new Error('boom')
    })
    const after = queue.enqueue('good', async () => {})

    await expect(failing).rejects.toThrow('boom')
    await expect(after).resolves.toBe(true)
  })
})
