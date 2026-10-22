import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProcessTableRow } from '../../shared/process-table-snapshot'

const snapshot = vi.hoisted(() => {
  const rows: ProcessTableRow[] = []
  return { rows }
})

vi.mock('../../shared/process-table-snapshot-reader', () => ({
  getFreshShellForegroundSnapshot: async () => snapshot.rows
}))

const { posixCliWriterShellAlone } = await import('../runtime/structured-agent-cli-writers')

// macOS terminals: the PTY root is login(1) and the shell is its only child.
const LOGIN = {
  pid: 100,
  ppid: 1,
  stat: 'Ss',
  command: '/usr/bin/login -flpq me /bin/bash --noprofile'
}
const SHELL = { pid: 101, ppid: 100, stat: 'S+', command: '-/bin/zsh -l' }

afterEach(() => {
  snapshot.rows = []
})

describe('posixCliWriterShellAlone behind the macOS login wrapper', () => {
  it('admits the shell login started once nothing runs in it', async () => {
    snapshot.rows = [LOGIN, SHELL]
    await expect(posixCliWriterShellAlone(LOGIN.pid)).resolves.toBe(true)
  })

  it('still refuses while a job runs under that shell', async () => {
    snapshot.rows = [
      LOGIN,
      SHELL,
      { pid: 102, ppid: 101, stat: 'S+', command: 'claude --resume x' }
    ]
    await expect(posixCliWriterShellAlone(LOGIN.pid)).resolves.toBe(false)
  })

  it('keeps judging an unwrapped shell root as before', async () => {
    snapshot.rows = [{ ...SHELL, ppid: 1 }]
    await expect(posixCliWriterShellAlone(SHELL.pid)).resolves.toBe(true)
  })
})
