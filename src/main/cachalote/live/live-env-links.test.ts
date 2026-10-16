import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { linkEnvFiles } from './live-env-links'

function put(root: string, relativePath: string, content: string): void {
  const absolute = path.join(root, relativePath)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

describe('linkEnvFiles', () => {
  let sandbox: string
  let repo: string
  let runner: string
  const globs = ['.env*', 'credentials_*.env', 'apps/*/.env']

  beforeEach(() => {
    sandbox = mkdtempSync(path.join(tmpdir(), 'cachalote-live-env-'))
    repo = path.join(sandbox, 'repo')
    runner = path.join(sandbox, 'runner')
    mkdirSync(repo)
    mkdirSync(runner)
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo })
    put(repo, '.gitignore', '.env\ncredentials_*.env\napps/*/.env\n')
    put(repo, '.env.example', 'KEY=\n')
    put(repo, '.env', 'SECRET=1\n')
    put(repo, 'credentials_local.env', 'TOKEN=1\n')
    put(repo, 'apps/web/.env', 'WEB=1\n')
    execFileSync('git', ['add', '.gitignore', '.env.example'], { cwd: repo })
  })

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true })
  })

  it('links ignored env files from the primary checkout', async () => {
    const linked = await linkEnvFiles({ repoPath: repo, runnerRoot: runner, globs })

    expect(linked.sort()).toEqual(['.env', 'apps/web/.env', 'credentials_local.env'])
    expect(readlinkSync(path.join(runner, '.env'))).toBe(path.join(repo, '.env'))
    expect(readlinkSync(path.join(runner, 'apps/web/.env'))).toBe(path.join(repo, 'apps/web/.env'))
  })

  it('leaves tracked files such as .env.example to the sync', async () => {
    await linkEnvFiles({ repoPath: repo, runnerRoot: runner, globs })

    expect(existsSync(path.join(runner, '.env.example'))).toBe(false)
  })

  it('is idempotent and never clobbers a regular file', async () => {
    writeFileSync(path.join(runner, '.env'), 'worktree copy')
    const first = await linkEnvFiles({ repoPath: repo, runnerRoot: runner, globs })
    const second = await linkEnvFiles({ repoPath: repo, runnerRoot: runner, globs })

    expect(first).not.toContain('.env')
    expect(lstatSync(path.join(runner, '.env')).isSymbolicLink()).toBe(false)
    expect(second.sort()).toEqual(first.sort())
  })

  it('returns nothing when no pattern matches', async () => {
    expect(await linkEnvFiles({ repoPath: repo, runnerRoot: runner, globs: ['nothing*'] })).toEqual(
      []
    )
  })
})
