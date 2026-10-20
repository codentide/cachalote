import { describe, expect, it } from 'vitest'
import {
  backgroundUpdateKey,
  hasCachaloteUpdate,
  toCachaloteUpdateState,
  parseInstalledBuildSha,
  parseSyncCheck,
  parseUpdateReport,
  parseUpdateRunOutcome,
  UPDATE_RESULT_MARKER,
  type CachaloteUpdateStatus
} from './cachalote-update-status'

describe('parseInstalledBuildSha', () => {
  it('reads the sha a local build stamps on its version', () => {
    expect(parseInstalledBuildSha('1.4.224-local.1791740258780.91ff1f4056e4')).toBe('91ff1f4056e4')
  })

  it('returns null for release and dev versions', () => {
    expect(parseInstalledBuildSha('1.4.224')).toBeNull()
    expect(parseInstalledBuildSha(null)).toBeNull()
  })
})

describe('parseSyncCheck', () => {
  it('maps the documented exit codes', () => {
    expect(parseSyncCheck(0, 'Al día: Orca 1.4.224')).toEqual({ kind: 'current' })
    expect(parseSyncCheck(10, 'Release nuevo: v1.4.230 (instalada: 1.4.224)')).toEqual({
      kind: 'new',
      tag: 'v1.4.230'
    })
    expect(parseSyncCheck(1, '')).toEqual({ kind: 'error' })
  })

  it('treats a new-release exit without a tag as a failure', () => {
    expect(parseSyncCheck(10, 'garbled')).toEqual({ kind: 'error' })
  })
})

describe('hasCachaloteUpdate', () => {
  const base: CachaloteUpdateStatus = {
    installedVersion: '1.4.224-local.1.abcdef1',
    upstream: { kind: 'current' },
    pendingCommits: []
  }

  it('is false when upstream is current and nothing is pending', () => {
    expect(hasCachaloteUpdate(base)).toBe(false)
  })

  it('offers an update for own commits even without a new release', () => {
    expect(hasCachaloteUpdate({ ...base, pendingCommits: ['3d93ed5d74 color'] })).toBe(true)
  })

  it('offers an update for a new upstream release', () => {
    expect(hasCachaloteUpdate({ ...base, upstream: { kind: 'new', tag: 'v1.4.230' } })).toBe(true)
  })

  it('does not offer one when the only signal is a failed check', () => {
    expect(hasCachaloteUpdate({ ...base, upstream: { kind: 'error' }, pendingCommits: null })).toBe(
      false
    )
  })
})

describe('toCachaloteUpdateState', () => {
  const base: CachaloteUpdateStatus = {
    installedVersion: '1.4.224-local.1.abcdef1',
    upstream: { kind: 'current' },
    pendingCommits: []
  }

  it('reports up to date with the installed version', () => {
    expect(toCachaloteUpdateState(base)).toEqual({
      kind: 'current',
      version: '1.4.224-local.1.abcdef1'
    })
  })

  it('reports an unreachable upstream when nothing else is pending', () => {
    expect(toCachaloteUpdateState({ ...base, upstream: { kind: 'error' } })).toEqual({
      kind: 'unreachable'
    })
  })

  it('lists own changes as readable titles next to the new release', () => {
    expect(
      toCachaloteUpdateState({
        ...base,
        upstream: { kind: 'new', tag: 'v1.4.230' },
        pendingCommits: ['3d93ed5d74 feat(cachalote): color for worktree groups']
      })
    ).toEqual({
      kind: 'available',
      release: 'v1.4.230',
      changes: ['Color for worktree groups'],
      upstreamUnreachable: false
    })
  })

  it('still offers own changes when upstream could not be checked', () => {
    expect(
      toCachaloteUpdateState({
        ...base,
        upstream: { kind: 'error' },
        pendingCommits: ['abcdef1 fix: thing']
      })
    ).toMatchObject({ kind: 'available', release: null, upstreamUnreachable: true })
  })
})

describe('backgroundUpdateKey', () => {
  it('surfaces a new upstream release, keyed by release and changes', () => {
    expect(
      backgroundUpdateKey({
        kind: 'available',
        release: 'v1.4.230',
        changes: ['Color'],
        upstreamUnreachable: false
      })
    ).toBe('v1.4.230\nColor')
  })

  it('stays quiet for own commits alone and for every non-update state', () => {
    expect(
      backgroundUpdateKey({
        kind: 'available',
        release: null,
        changes: ['Color'],
        upstreamUnreachable: false
      })
    ).toBeNull()
    expect(backgroundUpdateKey({ kind: 'current', version: '1.4.224' })).toBeNull()
    expect(backgroundUpdateKey({ kind: 'unreachable' })).toBeNull()
  })
})

describe('parseUpdateRunOutcome', () => {
  const earlierRun = [
    '=== Wed Oct 14 20:43:10 -05 2026 ===',
    'cachalote-sync: an older failure that must not leak into the next run',
    `${UPDATE_RESULT_MARKER}failed`
  ]

  it('reads a successful last run', () => {
    const log = [
      ...earlierRun,
      '=== Thu Oct 15 10:28:45 -05 2026 ===',
      '→ pnpm install',
      `${UPDATE_RESULT_MARKER}ok`
    ]
    expect(parseUpdateRunOutcome(log.join('\n'))).toEqual({ kind: 'ok' })
  })

  it('reports the sync message and the builder error of a failed run', () => {
    const log = [
      ...earlierRun,
      '=== Thu Oct 15 10:28:45 -05 2026 ===',
      '  ⨯ [verify-packaged-daemon-entry] the x64 terminal host did not serve a PTY: no daemon token',
      'cachalote-sync: falló el build; la app instalada no se tocó',
      `${UPDATE_RESULT_MARKER}failed`
    ]
    expect(parseUpdateRunOutcome(log.join('\n'))).toEqual({
      kind: 'failed',
      reason:
        'falló el build; la app instalada no se tocó — [verify-packaged-daemon-entry] the x64 terminal host did not serve a PTY: no daemon token'
    })
  })

  it('treats a failed result without details as a failure with no reason', () => {
    const log = ['=== Thu Oct 15 10:28:45 -05 2026 ===', `${UPDATE_RESULT_MARKER}failed`]
    expect(parseUpdateRunOutcome(log.join('\n'))).toEqual({ kind: 'failed', reason: null })
  })

  it('does not know how a run without result or errors ended', () => {
    expect(
      parseUpdateRunOutcome(['=== Thu Oct 15 10:28:45 -05 2026 ===', '→ pnpm install'].join('\n'))
    ).toEqual({
      kind: 'unknown'
    })
  })
})

describe('parseUpdateReport', () => {
  it('reads the release, the reapplied files and the pending test files', () => {
    expect(
      parseUpdateReport(
        [
          'tag=v1.4.233',
          'reapplied=2',
          'reapplied_files=src/a.ts src/b.tsx ',
          'pending_test_errors=src/c.test.ts ',
          'resolved=1',
          'resolved_files=src/d.ts '
        ].join('\n')
      )
    ).toEqual({
      release: 'v1.4.233',
      reappliedFiles: ['src/a.ts', 'src/b.tsx'],
      resolvedFiles: ['src/d.ts'],
      pendingTestFiles: ['src/c.test.ts']
    })
  })

  it('treats empty and missing keys as nothing to report', () => {
    expect(parseUpdateReport('tag=\nreapplied=0\nreapplied_files=\n')).toEqual({
      release: null,
      reappliedFiles: [],
      resolvedFiles: [],
      pendingTestFiles: []
    })
  })
})
