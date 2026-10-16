import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LiveProjectConfig } from '../../../shared/cachalote/live/live-types'
import { LiveConfigStore, liveSlotKey, parseLiveSlotKey } from './live-config-store'

const config: LiveProjectConfig = {
  repoId: 'repo-1',
  slots: [
    {
      id: 'web',
      label: 'Web',
      port: 3000,
      install: 'pnpm install',
      start: 'pnpm dev',
      depsFiles: ['package.json'],
      envFiles: ['.env*']
    }
  ]
}

describe('LiveConfigStore', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'cachalote-live-store-'))
    file = path.join(dir, 'cachalote-live.json')
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('persists configs and slot records in the documented shape, without leftovers', async () => {
    const store = new LiveConfigStore(file, 0)
    store.setConfig(config)
    store.setSlot(liveSlotKey('repo-1', 'web'), {
      worktreeId: 'repo-1::/wt',
      manifest: { 'a.txt': { id: 'abc', mode: '100644' } },
      terminal: { worktreeId: 'repo-1::/main', tabId: 't', ptyId: 'p' },
      startedAt: 5
    })
    await store.flush()

    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      version: 1,
      configs: { 'repo-1': config },
      slots: {
        'repo-1::web': {
          worktreeId: 'repo-1::/wt',
          manifest: { 'a.txt': { id: 'abc', mode: '100644' } },
          terminal: { worktreeId: 'repo-1::/main', tabId: 't', ptyId: 'p' },
          startedAt: 5
        }
      }
    })
    expect(readdirSync(dir)).toEqual(['cachalote-live.json'])
  })

  it('reloads what it wrote', async () => {
    const first = new LiveConfigStore(file, 0)
    first.setConfig(config)
    first.setSlot('repo-1::web', {
      worktreeId: null,
      manifest: {},
      terminal: null,
      startedAt: null
    })
    await first.flush()

    const second = new LiveConfigStore(file, 0)

    expect(second.getConfig('repo-1')).toEqual(config)
    expect(second.getSlot('repo-1::web')).toEqual({
      worktreeId: null,
      manifest: {},
      terminal: null,
      startedAt: null
    })
    expect(second.slotKeys()).toEqual(['repo-1::web'])
  })

  it('coalesces bursts of changes into one write', async () => {
    const store = new LiveConfigStore(file, 20)
    store.setConfig(config)
    store.deleteConfig('repo-1')
    store.setConfig({ ...config, repoId: 'repo-2' })

    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')).configs)).toEqual(['repo-2'])
  })

  it('starts empty on a missing, corrupt or foreign-version file and drops malformed entries', () => {
    expect(new LiveConfigStore(file).getConfig('repo-1')).toBeNull()
    writeFileSync(file, '{not json')
    expect(new LiveConfigStore(file).slotKeys()).toEqual([])
    writeFileSync(file, JSON.stringify({ version: 2, configs: { 'repo-1': config } }))
    expect(new LiveConfigStore(file).getConfig('repo-1')).toBeNull()
    writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        configs: { good: { ...config, repoId: 'good' }, bad: { repoId: 'bad', slots: [{}] } },
        slots: { a: { worktreeId: 5 }, b: { worktreeId: null, manifest: { x: 1 } } }
      })
    )
    const store = new LiveConfigStore(file)

    expect(store.getConfig('good')).not.toBeNull()
    expect(store.getConfig('bad')).toBeNull()
    expect(store.slotKeys()).toEqual(['b'])
    expect(store.getSlot('b')?.manifest).toEqual({})
  })

  it('splits slot keys on the last separator', () => {
    expect(parseLiveSlotKey('repo-1::web')).toEqual({ repoId: 'repo-1', slotId: 'web' })
    expect(parseLiveSlotKey('nonsense')).toBeNull()
  })

  it('flushSync writes only when something changed', () => {
    const store = new LiveConfigStore(file)
    store.flushSync()
    expect(readdirSync(dir)).toEqual([])
    store.setConfig(config)
    store.flushSync()
    expect(readdirSync(dir)).toEqual(['cachalote-live.json'])
  })
})
