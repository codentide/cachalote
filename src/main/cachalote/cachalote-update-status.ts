// Pure decisions behind Cachalote's "Check for Updates…"; the effects live in cachalote-self-update.ts.
import {
  toChangeTitle,
  type CachaloteUpdateState
} from '../../shared/cachalote/cachalote-update-state'

export type UpstreamCheck = { kind: 'current' } | { kind: 'new'; tag: string } | { kind: 'error' }

export type CachaloteUpdateStatus = {
  installedVersion: string | null
  upstream: UpstreamCheck
  /** `mine` commits missing from the installed build; null when that build carries no sha. */
  pendingCommits: readonly string[] | null
}

/** `1.4.224-local.<ts>.<sha>` → `<sha>`; release or dev versions carry none. */
export function parseInstalledBuildSha(version: string | null): string | null {
  return version?.match(/-local\.\d+\.([0-9a-f]{7,40})$/)?.[1] ?? null
}

/** Reads `cachalote-sync --check`: exit 0 is current, 10 is a new release, anything else failed. */
export function parseSyncCheck(code: number | null, stdout: string): UpstreamCheck {
  if (code === 0) {
    return { kind: 'current' }
  }
  const tag = stdout.match(/\b(v\d+\.\d+\.\d+)\b/)?.[1]
  return code === 10 && tag ? { kind: 'new', tag } : { kind: 'error' }
}

/**
 * Identity of an update worth surfacing unprompted, or null. Only a new upstream release qualifies:
 * own commits are made on purpose, so they wait for a manual check instead of nagging mid-work.
 */
export function backgroundUpdateKey(state: CachaloteUpdateState): string | null {
  return state.kind === 'available' && state.release
    ? [state.release, ...state.changes].join('\n')
    : null
}

export function hasCachaloteUpdate(status: CachaloteUpdateStatus): boolean {
  return status.upstream.kind === 'new' || (status.pendingCommits?.length ?? 0) > 0
}

/** The card state for a finished check. */
export function toCachaloteUpdateState(status: CachaloteUpdateStatus): CachaloteUpdateState {
  if (!hasCachaloteUpdate(status)) {
    return status.upstream.kind === 'error'
      ? { kind: 'unreachable' }
      : { kind: 'current', version: status.installedVersion }
  }
  return {
    kind: 'available',
    release: status.upstream.kind === 'new' ? status.upstream.tag : null,
    changes: (status.pendingCommits ?? []).map(toChangeTitle),
    upstreamUnreachable: status.upstream.kind === 'error'
  }
}

/** Printed by the update job after cachalote-sync, so the app can tell how the run ended. */
export const UPDATE_RESULT_MARKER = '### cachalote-update result: '
const RUN_HEADER = /^=== .+ ===$/
const SYNC_ERROR_PREFIX = 'cachalote-sync: '
const BUILDER_ERROR_PREFIX = '⨯ '

export type UpdateRunOutcome =
  | { kind: 'ok' }
  | { kind: 'failed'; reason: string | null }
  | { kind: 'unknown' }

function findLastLine(lines: readonly string[], matches: (line: string) => boolean): string | null {
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index]!
    if (matches(line)) {
      return line
    }
  }
  return null
}

/** How the last run in the update log ended; `reason` is cachalote-sync's message plus the builder's error. */
export function parseUpdateRunOutcome(logTail: string): UpdateRunOutcome {
  const lines = logTail.split('\n')
  const header = findLastLine(lines, (line) => RUN_HEADER.test(line))
  const run = header === null ? lines : lines.slice(lines.lastIndexOf(header) + 1)
  const result = findLastLine(run, (line) => line.startsWith(UPDATE_RESULT_MARKER))
    ?.slice(UPDATE_RESULT_MARKER.length)
    .trim()
  if (result === 'ok') {
    return { kind: 'ok' }
  }
  const syncError = findLastLine(run, (line) => line.startsWith(SYNC_ERROR_PREFIX))
    ?.slice(SYNC_ERROR_PREFIX.length)
    .trim()
  const builderError = findLastLine(run, (line) =>
    line.trimStart().startsWith(BUILDER_ERROR_PREFIX)
  )
    ?.trim()
    .slice(BUILDER_ERROR_PREFIX.length)
  const reason = [syncError, builderError].filter(Boolean).join(' — ') || null
  return result === 'failed' || reason ? { kind: 'failed', reason } : { kind: 'unknown' }
}
