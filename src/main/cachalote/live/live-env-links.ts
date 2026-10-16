import { lstat, readdir, readlink } from 'node:fs/promises'
import path from 'node:path'
import { checkIgnoredPaths } from '../../git/check-ignored-paths'
import {
  isNodeError,
  resolveInsideRunner,
  RunnerDirectories,
  writeRunnerSymlink
} from './live-runner-fs'

const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules'])

function segmentPattern(segment: string): RegExp {
  const escaped = segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')
  return new RegExp(`^${escaped}$`)
}

/** Expands one repo-relative glob (`*` within a single segment) to the regular files that match. */
async function expandGlob(repoRoot: string, glob: string): Promise<string[]> {
  const segments = glob.split('/').filter((segment) => segment && segment !== '.')
  let frontier = ['']
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    const isLast = index === segments.length - 1
    const next: string[] = []
    for (const base of frontier) {
      if (!segment.includes('*')) {
        next.push(path.posix.join(base, segment))
        continue
      }
      const pattern = segmentPattern(segment)
      const entries = await readdir(path.join(repoRoot, base), { withFileTypes: true }).catch(
        () => []
      )
      for (const entry of entries) {
        const wanted = isLast ? entry.isFile() : entry.isDirectory()
        if (wanted && pattern.test(entry.name) && !SKIPPED_DIRECTORIES.has(entry.name)) {
          next.push(path.posix.join(base, entry.name))
        }
      }
    }
    frontier = next
  }
  const files: string[] = []
  for (const candidate of frontier) {
    const stats = await lstat(path.join(repoRoot, candidate)).catch(() => null)
    if (stats?.isFile()) {
      files.push(candidate)
    }
  }
  return files
}

/**
 * Symlinks the primary checkout's git-ignored env files into the runner. A tracked file such as
 * `.env.example` is the sync's job and is never linked. Returns the linked repo-relative paths.
 */
export async function linkEnvFiles(args: {
  repoPath: string
  runnerRoot: string
  globs: readonly string[]
}): Promise<string[]> {
  const candidates = new Set<string>()
  for (const glob of args.globs) {
    for (const file of await expandGlob(args.repoPath, glob)) {
      candidates.add(file)
    }
  }
  if (candidates.size === 0) {
    return []
  }
  const ignored = await checkIgnoredPaths(args.repoPath, [...candidates])
  const directories = new RunnerDirectories(args.runnerRoot)
  const linked: string[] = []
  for (const relativePath of ignored) {
    const absolute = resolveInsideRunner(args.runnerRoot, relativePath)
    if (!absolute || !candidates.has(relativePath)) {
      continue
    }
    const linkTarget = path.join(args.repoPath, relativePath)
    try {
      const parent = path.dirname(relativePath)
      await directories.ensure(parent === '.' ? '' : parent)
      const existing = await lstat(absolute).catch((error: unknown) => {
        if (isNodeError(error, 'ENOENT')) {
          return null
        }
        throw error
      })
      // A regular file here is the worktree's own copy; never clobber it with a link.
      if (existing && !existing.isSymbolicLink()) {
        continue
      }
      if (existing && (await readlink(absolute)) === linkTarget) {
        linked.push(relativePath)
        continue
      }
      await writeRunnerSymlink(linkTarget, absolute)
      linked.push(relativePath)
    } catch (error) {
      console.warn('[cachalote-live] could not link env file', relativePath, error)
    }
  }
  return linked
}
