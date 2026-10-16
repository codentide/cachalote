import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  chmodSync,
  statSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyRunnerChanges, deltaSync, fullSync, type LiveManifest } from './live-sync'

function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args],
    { cwd, encoding: 'utf8' }
  )
}

function put(root: string, relativePath: string, content: string): void {
  const absolute = path.join(root, relativePath)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

describe('live-sync', () => {
  let sandbox: string
  let main: string
  let runner: string
  let manifest: LiveManifest

  beforeEach(() => {
    sandbox = mkdtempSync(path.join(tmpdir(), 'cachalote-live-sync-'))
    main = path.join(sandbox, 'main')
    runner = path.join(sandbox, 'runner')
    mkdirSync(main)
    mkdirSync(runner)
    manifest = new Map()
    git(main, 'init', '-q', '-b', 'main')
    put(main, '.gitignore', 'node_modules/\n.env\n')
    put(main, 'src/app.js', 'app v1\n')
    put(main, 'src/deep/util.js', 'util v1\n')
    put(main, 'run.sh', '#!/bin/sh\n')
    chmodSync(path.join(main, 'run.sh'), 0o755)
    put(main, 'removed-later.txt', 'bye\n')
    put(main, '.env.example', 'KEY=\n')
    symlinkSync('src/app.js', path.join(main, 'link-to-app'))
    git(main, 'add', '-A')
    git(main, 'commit', '-q', '-m', 'init')
  })

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true })
  })

  const sync = (worktreePath: string) => fullSync({ worktreePath, runnerRoot: runner, manifest })

  it('copies tracked, modified and untracked files but never ignored ones', async () => {
    put(main, 'src/app.js', 'app v2 modified\n')
    put(main, 'new-file.txt', 'untracked\n')
    put(main, 'node_modules/pkg/index.js', 'ignored\n')
    put(main, '.env', 'SECRET=1\n')
    rmSync(path.join(main, 'removed-later.txt'))

    const result = await sync(main)

    expect(result.errors).toEqual([])
    expect(readFileSync(path.join(runner, 'src/app.js'), 'utf8')).toBe('app v2 modified\n')
    expect(readFileSync(path.join(runner, 'src/deep/util.js'), 'utf8')).toBe('util v1\n')
    expect(readFileSync(path.join(runner, 'new-file.txt'), 'utf8')).toBe('untracked\n')
    expect(existsSync(path.join(runner, 'node_modules'))).toBe(false)
    expect(existsSync(path.join(runner, '.env'))).toBe(false)
    expect(existsSync(path.join(runner, 'removed-later.txt'))).toBe(false)
    expect(manifest.has('.env')).toBe(false)
  })

  it('keeps the exec bit and recreates tracked symlinks', async () => {
    await sync(main)

    expect(statSync(path.join(runner, 'run.sh')).mode & 0o111).not.toBe(0)
    expect(statSync(path.join(runner, 'src/app.js')).mode & 0o111).toBe(0)
    expect(lstatSync(path.join(runner, 'link-to-app')).isSymbolicLink()).toBe(true)
    expect(readlinkSync(path.join(runner, 'link-to-app'))).toBe('src/app.js')
  })

  it('does nothing on a second sync with no changes', async () => {
    await sync(main)
    const inodeBefore = statSync(path.join(runner, 'src/app.js')).ino

    const again = await sync(main)

    expect(again).toEqual({ written: [], removed: [], errors: [] })
    expect(statSync(path.join(runner, 'src/app.js')).ino).toBe(inodeBefore)
  })

  it('copies only the difference when switching between worktrees', async () => {
    const other = path.join(sandbox, 'other')
    git(main, 'worktree', 'add', '-q', '-b', 'feature', other)
    put(other, 'src/app.js', 'app on feature\n')
    put(other, 'feature-only.txt', 'feature\n')
    rmSync(path.join(other, 'removed-later.txt'))
    await sync(main)

    const result = await sync(other)

    expect(result.written.sort()).toEqual(['feature-only.txt', 'src/app.js'])
    expect(result.removed).toEqual(['removed-later.txt'])
    expect(readFileSync(path.join(runner, 'src/app.js'), 'utf8')).toBe('app on feature\n')

    const back = await sync(main)
    expect(back.written.sort()).toEqual(['removed-later.txt', 'src/app.js'])
    expect(back.removed).toEqual(['feature-only.txt'])
  })

  it('never touches runner entries the manifest does not own', async () => {
    mkdirSync(path.join(runner, 'node_modules/pkg'), { recursive: true })
    writeFileSync(path.join(runner, 'node_modules/pkg/index.js'), 'installed')
    symlinkSync(path.join(main, '.env'), path.join(runner, '.env'))
    put(main, 'extra/only.txt', 'x\n')
    await sync(main)
    rmSync(path.join(main, 'extra'), { recursive: true })

    const result = await sync(main)

    expect(result.removed).toEqual(['extra/only.txt'])
    expect(existsSync(path.join(runner, 'extra'))).toBe(false)
    expect(readFileSync(path.join(runner, 'node_modules/pkg/index.js'), 'utf8')).toBe('installed')
    expect(lstatSync(path.join(runner, '.env')).isSymbolicLink()).toBe(true)
  })

  it('refuses paths that resolve outside the runner', async () => {
    put(main, 'ok.txt', 'ok\n')
    const result = await applyRunnerChanges(
      { worktreePath: main, runnerRoot: runner, manifest },
      ['../escaped.txt'],
      new Map([['../evil.txt', { id: 'x', mode: '100644' }]])
    )

    expect(result.errors).toHaveLength(2)
    expect(existsSync(path.join(sandbox, 'evil.txt'))).toBe(false)
  })

  it('does not write through a symlinked directory in the runner', async () => {
    const outside = path.join(sandbox, 'outside')
    mkdirSync(outside)
    symlinkSync(outside, path.join(runner, 'src'))

    const result = await sync(main)

    expect(result.errors.some((message) => message.startsWith('src/'))).toBe(true)
    expect(existsSync(path.join(outside, 'app.js'))).toBe(false)
  })

  it('treats unmerged or deleted-but-tracked paths without failing', async () => {
    rmSync(path.join(main, 'src/deep/util.js'))
    const result = await sync(main)
    expect(result.errors).toEqual([])
    expect(existsSync(path.join(runner, 'src/deep'))).toBe(false)
  })

  describe('deltaSync', () => {
    it('applies watcher paths: changed, ignored, deleted and whole directories', async () => {
      await sync(main)
      put(main, 'src/app.js', 'app v3\n')
      put(main, 'node_modules/x.js', 'ignored\n')
      rmSync(path.join(main, 'src/deep'), { recursive: true })

      const result = await deltaSync(
        { worktreePath: main, runnerRoot: runner, manifest },
        { deleted: ['src/deep'], changed: ['src/app.js', 'node_modules/x.js'] }
      )

      expect(result.errors).toEqual([])
      expect(result.written).toEqual(['src/app.js'])
      expect(result.removed).toEqual(['src/deep/util.js'])
      expect(result.needsFullSync).toBe(false)
      expect(readFileSync(path.join(runner, 'src/app.js'), 'utf8')).toBe('app v3\n')
      expect(existsSync(path.join(runner, 'node_modules'))).toBe(false)
      expect(existsSync(path.join(runner, 'src/deep'))).toBe(false)
    })

    it('a delta leaves the manifest consistent with a later full sync', async () => {
      await sync(main)
      put(main, 'src/app.js', 'edited\n')
      await deltaSync(
        { worktreePath: main, runnerRoot: runner, manifest },
        { deleted: [], changed: ['src/app.js'] }
      )

      const again = await sync(main)

      expect(again.written).toEqual([])
    })

    it('asks for a full sync when an ignore file changes', async () => {
      await sync(main)
      put(main, '.gitignore', 'node_modules/\n.env\nextra/\n')

      const result = await deltaSync(
        { worktreePath: main, runnerRoot: runner, manifest },
        { deleted: [], changed: ['.gitignore'] }
      )

      expect(result.needsFullSync).toBe(true)
    })
  })
})
