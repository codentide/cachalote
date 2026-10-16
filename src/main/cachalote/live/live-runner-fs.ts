import { constants } from 'node:fs'
import { chmod, copyFile, lstat, mkdir, rename, rmdir, symlink, unlink } from 'node:fs/promises'
import path from 'node:path'

/** Resolves a repo-relative path inside the runner; null when it would escape. */
export function resolveInsideRunner(runnerRoot: string, relativePath: string): string | null {
  if (
    !relativePath ||
    relativePath.includes('\0') ||
    path.isAbsolute(relativePath) ||
    relativePath.split(/[\\/]/).includes('..')
  ) {
    return null
  }
  const absolute = path.join(runnerRoot, relativePath)
  return absolute.startsWith(runnerRoot + path.sep) ? absolute : null
}

export function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

/** Creates runner directories one component at a time, refusing to write through a symlink. */
export class RunnerDirectories {
  private readonly known = new Map<string, Promise<void>>()

  constructor(private readonly runnerRoot: string) {}

  ensure(relativeDir: string): Promise<void> {
    if (!relativeDir || relativeDir === '.') {
      return Promise.resolve()
    }
    const cached = this.known.get(relativeDir)
    if (cached) {
      return cached
    }
    const pending = this.create(relativeDir)
    this.known.set(relativeDir, pending)
    pending.catch(() => this.known.delete(relativeDir))
    return pending
  }

  private async create(relativeDir: string): Promise<void> {
    const parent = path.dirname(relativeDir)
    await this.ensure(parent === '.' ? '' : parent)
    const absolute = resolveInsideRunner(this.runnerRoot, relativeDir)
    if (!absolute) {
      throw new Error(`path escapes the runner: ${relativeDir}`)
    }
    try {
      const stats = await lstat(absolute)
      if (!stats.isDirectory()) {
        throw new Error(`not a directory in the runner: ${relativeDir}`)
      }
    } catch (error) {
      if (!isNodeError(error, 'ENOENT')) {
        throw error
      }
      await mkdir(absolute).catch((mkdirError: unknown) => {
        if (!isNodeError(mkdirError, 'EEXIST')) {
          throw mkdirError
        }
      })
    }
  }
}

let tempCounter = 0

function tempSibling(target: string): string {
  tempCounter += 1
  return path.join(
    path.dirname(target),
    `.${path.basename(target)}.cachalote-${process.pid}-${tempCounter}.tmp`
  )
}

/** Clears a directory sitting where a file or link must go; only an empty one is removed. */
async function clearDirectoryAt(target: string): Promise<void> {
  const stats = await lstat(target).catch(() => null)
  if (stats?.isDirectory()) {
    await rmdir(target)
  }
}

/** Writes through a sibling temp file and rename, so a hot-reloading server never reads half a file. */
export async function writeRunnerFile(
  source: string,
  target: string,
  executable: boolean
): Promise<void> {
  const temp = tempSibling(target)
  try {
    await copyFile(source, temp, constants.COPYFILE_FICLONE)
    await chmod(temp, executable ? 0o755 : 0o644)
    await clearDirectoryAt(target)
    await rename(temp, target)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

export async function writeRunnerSymlink(linkTarget: string, target: string): Promise<void> {
  const temp = tempSibling(target)
  try {
    await symlink(linkTarget, temp)
    await clearDirectoryAt(target)
    await rename(temp, target)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

/** Removes a file or link the manifest owns; a directory in its place goes only when empty. */
export async function removeRunnerEntry(target: string): Promise<void> {
  try {
    await unlink(target)
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) {
      return
    }
    if (isNodeError(error, 'EISDIR') || isNodeError(error, 'EPERM')) {
      await rmdir(target)
      return
    }
    throw error
  }
}

/** Removes emptied directories upward, stopping at the first one that still has content. */
export async function pruneEmptyDirectories(
  runnerRoot: string,
  relativeDirs: Iterable<string>
): Promise<void> {
  const ordered = [...new Set(relativeDirs)].sort((a, b) => b.length - a.length)
  for (const start of ordered) {
    let current = start
    while (current && current !== '.') {
      const absolute = resolveInsideRunner(runnerRoot, current)
      if (!absolute) {
        break
      }
      try {
        await rmdir(absolute)
      } catch {
        break
      }
      current = path.dirname(current)
    }
  }
}
