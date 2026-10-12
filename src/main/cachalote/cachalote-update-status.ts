// Pure decisions behind Cachalote's "Check for Updates…"; the effects live in cachalote-self-update.ts.

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

export function hasCachaloteUpdate(status: CachaloteUpdateStatus): boolean {
  return status.upstream.kind === 'new' || (status.pendingCommits?.length ?? 0) > 0
}
