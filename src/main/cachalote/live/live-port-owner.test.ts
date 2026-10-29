import { describe, expect, it, vi } from 'vitest'
import {
  isInsideDirectory,
  parseLsofCwds,
  parseLsofListeners,
  parseProcessTable,
  PortInspector,
  subtreeRssBytes,
  terminateProcess,
  type SystemCommand
} from './live-port-owner'

const RUNNER = '/runners/app/web'

describe('lsof and ps parsing', () => {
  it('reads listener pids and names', () => {
    expect(parseLsofListeners('p1234\ncnode\nn*:3000\np99\ncpython\nn[::1]:3000\n')).toEqual([
      { pid: 1234, name: 'node' },
      { pid: 99, name: 'python' }
    ])
  })

  it('reads the cwd of each pid', () => {
    expect(parseLsofCwds(`p10\nn${RUNNER}\np11\nn/\n`)).toEqual(
      new Map([
        [10, RUNNER],
        [11, '/']
      ])
    )
  })

  it('sums the resident memory of a whole subtree, in bytes', () => {
    const rows = parseProcessTable(' 1 0 10\n 100 1 100\n 101 100 200\n 102 101 300\n 200 1 999\n')

    expect(subtreeRssBytes(rows, 100)).toBe(600 * 1024)
    expect(subtreeRssBytes(rows, 102)).toBe(300 * 1024)
  })

  it('matches directories by prefix on a path boundary', () => {
    expect(isInsideDirectory(RUNNER, RUNNER)).toBe(true)
    expect(isInsideDirectory(RUNNER, `${RUNNER}/sub`)).toBe(true)
    expect(isInsideDirectory(RUNNER, `${RUNNER}-other`)).toBe(false)
    expect(isInsideDirectory(RUNNER, null)).toBe(false)
  })
})

function fakeSystem(cwds: Record<number, string>): SystemCommand {
  return async (program, args) => {
    if (program === 'lsof' && args.includes('-sTCP:LISTEN')) {
      return 'p102\ncnode\nn*:3000\n'
    }
    if (program === 'lsof') {
      const pids = (args[args.indexOf('-p') + 1] ?? '').split(',').map(Number)
      return pids
        .filter((pid) => cwds[pid])
        .map((pid) => `p${pid}\nn${cwds[pid]}\n`)
        .join('')
    }
    if (args.includes('-axo')) {
      return ' 100 1 100\n 101 100 200\n 102 101 300\n 103 102 400\n 200 1 999\n'
    }
    return 'next dev --port 3000\n'
  }
}

describe('PortInspector', () => {
  it('resolves the owner with its cwd and full command', async () => {
    const inspector = new PortInspector(fakeSystem({ 102: RUNNER }))

    expect(await inspector.resolveOwner(3000)).toEqual({
      pid: 102,
      command: 'next dev --port 3000',
      cwd: RUNNER
    })
  })

  it('returns null when nothing listens', async () => {
    const inspector = new PortInspector(async () => '')

    expect(await inspector.resolveOwner(3000)).toBeNull()
    expect(await inspector.treeRssBytes(3000, RUNNER)).toBeNull()
  })

  it('walks up through ancestors that still live in the runner and sums that tree', async () => {
    const inspector = new PortInspector(fakeSystem({ 102: RUNNER, 101: RUNNER, 100: RUNNER }))

    expect(await inspector.treeRssBytes(3000, RUNNER)).toBe((100 + 200 + 300 + 400) * 1024)
  })

  it('stops climbing at the first ancestor outside the runner', async () => {
    const inspector = new PortInspector(fakeSystem({ 102: RUNNER, 101: RUNNER, 100: '/' }))

    expect(await inspector.treeRssBytes(3000, RUNNER)).toBe((200 + 300 + 400) * 1024)
  })

  it('reports nothing for a listener that is not in the runner', async () => {
    const inspector = new PortInspector(fakeSystem({ 102: '/elsewhere' }))

    expect(await inspector.treeRssBytes(3000, RUNNER)).toBeNull()
  })
})

describe('terminateProcess', () => {
  it('refuses Cachalot itself and init', () => {
    expect(() => terminateProcess(process.pid, vi.fn())).toThrow()
    expect(() => terminateProcess(1, vi.fn())).toThrow()
  })

  it('treats a process that already exited as success', () => {
    const kill = vi.fn(() => {
      throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' })
    })

    expect(() => terminateProcess(4242, kill)).not.toThrow()
    expect(kill).toHaveBeenCalledWith(4242, 'SIGTERM')
  })

  it('surfaces other failures', () => {
    const kill = vi.fn(() => {
      throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' })
    })

    expect(() => terminateProcess(4242, kill)).toThrow('EPERM')
  })
})
