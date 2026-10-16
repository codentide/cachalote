import { lstat, readlink } from 'node:fs/promises'
import path from 'node:path'
import { gitExecFileAsync } from '../../git/command-runner/git-exec-file'
import { gitOptionalLocksDisabledEnv } from '../../git/command-runner/git-process-env'
import { checkIgnoredPaths } from '../../git/check-ignored-paths'
import { mapWithConcurrency } from '../../../shared/map-with-concurrency'
import {
  isNodeError,
  pruneEmptyDirectories,
  removeRunnerEntry,
  resolveInsideRunner,
  RunnerDirectories,
  writeRunnerFile,
  writeRunnerSymlink
} from './live-runner-fs'

/** What the runner holds for a path: the git blob id (or `link:<target>`) and the file mode. */
export type ManifestEntry = { id: string; mode: string }
/** Repo-relative path to entry; only paths in here are ever touched in the runner. */
export type LiveManifest = Map<string, ManifestEntry>
export type WorktreeSnapshot = Map<string, ManifestEntry>

export type SyncTarget = { worktreePath: string; runnerRoot: string; manifest: LiveManifest }
export type SyncResult = { written: string[]; removed: string[]; errors: string[] }
export type DeltaSyncResult = SyncResult & { needsFullSync: boolean }

const GIT_MAX_BUFFER = 512 * 1024 * 1024
const IO_CONCURRENCY = 16
const MODE_LINK = '120000'
const MODE_EXEC = '100755'
const MODE_FILE = '100644'
const MODE_SUBMODULE = '160000'

async function runGit(cwd: string, args: string[], stdin?: string): Promise<string> {
  const { stdout } = await gitExecFileAsync(args, {
    cwd,
    env: gitOptionalLocksDisabledEnv(),
    maxBuffer: GIT_MAX_BUFFER,
    ...(stdin === undefined ? {} : { stdin })
  })
  return stdout
}

async function lsFiles(cwd: string, flags: string[]): Promise<string[]> {
  const stdout = await runGit(cwd, ['ls-files', ...flags, '-z'])
  return stdout.split('\0').filter((entry) => entry.length > 0)
}

// Entry format: `<mode> <blob> <stage>\t<path>`.
const STAGED_ENTRY = /^(\d{6}) ([0-9a-f]+) (\d)\t([\s\S]+)$/

function parseStagedEntries(entries: string[]): Map<string, ManifestEntry> {
  const tracked = new Map<string, ManifestEntry>()
  for (const entry of entries) {
    const match = STAGED_ENTRY.exec(entry)
    if (!match) {
      continue
    }
    const [, mode, id, stage, filePath] = match
    if (mode !== MODE_SUBMODULE && stage === '0') {
      tracked.set(filePath, { id, mode })
    }
  }
  return tracked
}

// git reads a quoted line with C-style escapes, which keeps newline-bearing names intact.
function quoteForStdinPaths(filePath: string): string {
  if (!/[\n\r"\\]/.test(filePath) && !filePath.startsWith('"')) {
    return filePath
  }
  const escaped = filePath
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
  return `"${escaped}"`
}

/** Blob ids for regular files, in one git call; filters apply as they would on commit. */
async function hashFiles(cwd: string, filePaths: string[]): Promise<string[]> {
  if (filePaths.length === 0) {
    return []
  }
  const stdout = await runGit(
    cwd,
    ['hash-object', '--stdin-paths'],
    `${filePaths.map(quoteForStdinPaths).join('\n')}\n`
  )
  const ids = stdout.split('\n').filter((line) => line.length > 0)
  if (ids.length !== filePaths.length) {
    throw new Error('git hash-object returned an unexpected number of ids')
  }
  return ids
}

type WorktreeEntryKind =
  | { kind: 'file'; mode: string }
  | { kind: 'link'; target: string }
  | { kind: 'absent' }

/** lstat is the source of truth for type and exec bit; a symlink is identified by its target. */
async function classifyWorktreeEntry(absolute: string): Promise<WorktreeEntryKind> {
  try {
    const stats = await lstat(absolute)
    if (stats.isSymbolicLink()) {
      return { kind: 'link', target: await readlink(absolute) }
    }
    if (stats.isFile()) {
      return { kind: 'file', mode: stats.mode & 0o100 ? MODE_EXEC : MODE_FILE }
    }
    return { kind: 'absent' }
  } catch (error) {
    if (isNodeError(error, 'ENOENT') || isNodeError(error, 'ENOTDIR')) {
      return { kind: 'absent' }
    }
    throw error
  }
}

/** Entries for paths whose content git's index cannot vouch for (modified, untracked, event-reported). */
async function describePaths(
  worktreePath: string,
  relativePaths: string[]
): Promise<Map<string, ManifestEntry | null>> {
  const kinds = await mapWithConcurrency(relativePaths, 32, (relativePath) =>
    classifyWorktreeEntry(path.join(worktreePath, relativePath))
  )
  const described = new Map<string, ManifestEntry | null>()
  const toHash: { relativePath: string; mode: string }[] = []
  relativePaths.forEach((relativePath, index) => {
    const kind = kinds[index]
    if (kind.kind === 'absent') {
      described.set(relativePath, null)
    } else if (kind.kind === 'link') {
      described.set(relativePath, { id: `link:${kind.target}`, mode: MODE_LINK })
    } else {
      toHash.push({ relativePath, mode: kind.mode })
    }
  })
  const ids = await hashFiles(
    worktreePath,
    toHash.map((item) => item.relativePath)
  )
  toHash.forEach((item, index) => {
    described.set(item.relativePath, { id: ids[index], mode: item.mode })
  })
  return described
}

async function enumerateWorktreeUncached(worktreePath: string): Promise<WorktreeSnapshot> {
  const [staged, modified, deleted, untracked] = await Promise.all([
    lsFiles(worktreePath, ['-s']),
    lsFiles(worktreePath, ['-m']),
    lsFiles(worktreePath, ['-d']),
    lsFiles(worktreePath, ['-o', '--exclude-standard'])
  ])
  const snapshot = parseStagedEntries(staged)
  const deletedSet = new Set(deleted)
  for (const deletedPath of deletedSet) {
    snapshot.delete(deletedPath)
  }
  // A trailing slash marks a nested repository, which is not ours to copy.
  const candidates = [...new Set([...modified, ...untracked])].filter(
    (candidate) => !deletedSet.has(candidate) && !candidate.endsWith('/')
  )
  const described = await describePaths(worktreePath, candidates)
  for (const [relativePath, entry] of described) {
    if (entry) {
      snapshot.set(relativePath, entry)
    } else {
      snapshot.delete(relativePath)
    }
  }
  return snapshot
}

const enumerationsInFlight = new Map<string, Promise<WorktreeSnapshot>>()

/** Slots serving the same worktree in the same tick share one enumeration. */
export function enumerateWorktree(worktreePath: string): Promise<WorktreeSnapshot> {
  const shared = enumerationsInFlight.get(worktreePath)
  if (shared) {
    return shared
  }
  const pending = enumerateWorktreeUncached(worktreePath).finally(() => {
    enumerationsInFlight.delete(worktreePath)
  })
  enumerationsInFlight.set(worktreePath, pending)
  return pending
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Applies removals, then writes, touching only paths in `remove`/`write`; updates the manifest as it goes. */
export async function applyRunnerChanges(
  target: SyncTarget,
  remove: string[],
  write: Map<string, ManifestEntry>
): Promise<SyncResult> {
  const result: SyncResult = { written: [], removed: [], errors: [] }
  const emptiedDirs = new Set<string>()

  const removeOwned = async (relativePath: string): Promise<void> => {
    const absolute = resolveInsideRunner(target.runnerRoot, relativePath)
    if (!absolute) {
      result.errors.push(`${relativePath}: path escapes the runner`)
      return
    }
    try {
      await removeRunnerEntry(absolute)
      target.manifest.delete(relativePath)
      result.removed.push(relativePath)
      emptiedDirs.add(path.dirname(relativePath))
    } catch (error) {
      result.errors.push(`${relativePath}: ${errorMessage(error)}`)
    }
  }

  await mapWithConcurrency(remove, IO_CONCURRENCY, removeOwned)
  await pruneEmptyDirectories(target.runnerRoot, emptiedDirs)

  const directories = new RunnerDirectories(target.runnerRoot)
  const writeOne = async ([relativePath, entry]: [string, ManifestEntry]): Promise<void> => {
    const absolute = resolveInsideRunner(target.runnerRoot, relativePath)
    if (!absolute) {
      result.errors.push(`${relativePath}: path escapes the runner`)
      return
    }
    try {
      const source = path.join(target.worktreePath, relativePath)
      const kind = await classifyWorktreeEntry(source)
      if (kind.kind === 'absent') {
        // Vanished since it was listed (or never on disk, as with sparse checkouts): mirror that.
        if (target.manifest.has(relativePath)) {
          await removeOwned(relativePath)
        }
        return
      }
      const parent = path.dirname(relativePath)
      await directories.ensure(parent === '.' ? '' : parent)
      await (kind.kind === 'link'
        ? writeRunnerSymlink(kind.target, absolute)
        : writeRunnerFile(source, absolute, entry.mode === MODE_EXEC))
      target.manifest.set(relativePath, entry)
      result.written.push(relativePath)
    } catch (error) {
      result.errors.push(`${relativePath}: ${errorMessage(error)}`)
    }
  }
  await mapWithConcurrency([...write.entries()], IO_CONCURRENCY, writeOne)
  return result
}

/** Compares a worktree snapshot with what the runner holds and applies only the difference. */
export async function fullSync(target: SyncTarget): Promise<SyncResult> {
  const snapshot = await enumerateWorktree(target.worktreePath)
  const remove: string[] = []
  for (const owned of target.manifest.keys()) {
    if (!snapshot.has(owned)) {
      remove.push(owned)
    }
  }
  const write = new Map<string, ManifestEntry>()
  for (const [relativePath, entry] of snapshot) {
    const current = target.manifest.get(relativePath)
    if (!current || current.id !== entry.id || current.mode !== entry.mode) {
      write.set(relativePath, entry)
    }
  }
  return applyRunnerChanges(target, remove, write)
}

function manifestPathsUnder(manifest: LiveManifest, deleted: Set<string>): string[] {
  const hits: string[] = []
  for (const owned of manifest.keys()) {
    let ancestor = owned
    while (ancestor && ancestor !== '.') {
      if (deleted.has(ancestor)) {
        hits.push(owned)
        break
      }
      ancestor = path.dirname(ancestor)
    }
  }
  return hits
}

/** Applies watcher-reported paths; `needsFullSync` when something only a full enumeration can settle. */
export async function deltaSync(
  target: SyncTarget,
  paths: { deleted: string[]; changed: string[] }
): Promise<DeltaSyncResult> {
  const remove = new Set(manifestPathsUnder(target.manifest, new Set(paths.deleted)))
  const ignored = new Set(await checkIgnoredPaths(target.worktreePath, paths.changed))
  const live = paths.changed.filter((changedPath) => !ignored.has(changedPath))
  const described = await describePaths(target.worktreePath, live)
  const write = new Map<string, ManifestEntry>()
  for (const [relativePath, entry] of described) {
    if (!entry) {
      if (target.manifest.has(relativePath)) {
        remove.add(relativePath)
      }
      continue
    }
    const current = target.manifest.get(relativePath)
    if (!current || current.id !== entry.id || current.mode !== entry.mode) {
      write.set(relativePath, entry)
    }
  }
  const result = await applyRunnerChanges(target, [...remove], write)
  // A directory event or an ignore-rule edit changes which files exist; only the index knows.
  const needsFullSync = live.some((changedPath) => path.basename(changedPath) === '.gitignore')
  return { ...result, needsFullSync }
}
