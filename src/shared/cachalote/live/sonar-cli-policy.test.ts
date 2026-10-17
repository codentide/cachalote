import { describe, expect, it } from 'vitest'
import type { SonarSlotStatus } from '../../rpc-contract/cachalote-sonar-params'
import { pickSonarSlot, sonarConflict, sonarServeProgress } from './sonar-cli-policy'

const A = 'repo-web::/wt/a'
const B = 'repo-web::/wt/b'

function slot(overrides: Partial<SonarSlotStatus> = {}): SonarSlotStatus {
  return {
    repoId: 'repo-web',
    slotId: 'web',
    label: 'Web',
    port: 3000,
    phase: 'idle',
    worktreeId: null,
    startedAt: null,
    error: null,
    portOwner: null,
    url: 'http://localhost:3000',
    worktreePath: null,
    ...overrides
  }
}

describe('pickSonarSlot', () => {
  const web = slot()
  const docs = slot({ slotId: 'docs', label: 'Docs', port: 3001, url: 'http://localhost:3001' })
  const api = slot({ repoId: 'repo-api', slotId: 'api', port: 8080 })

  it('takes the only slot of the caller project', () => {
    expect(pickSonarSlot([web, api], { repoId: 'repo-web', worktreeId: A })).toEqual({
      ok: true,
      slot: web
    })
  })

  it('reports a project without slots', () => {
    expect(pickSonarSlot([api], { repoId: 'repo-web', worktreeId: A })).toEqual({
      ok: false,
      reason: 'no-slots',
      ports: []
    })
  })

  it('asks for a port when the project has several', () => {
    expect(pickSonarSlot([web, docs], { repoId: 'repo-web', worktreeId: A })).toEqual({
      ok: false,
      reason: 'ambiguous',
      ports: [3000, 3001]
    })
  })

  it('matches --port and --slot, and lists the options on a miss', () => {
    expect(pickSonarSlot([web, docs], { repoId: 'repo-web', worktreeId: A, port: 3001 })).toEqual({
      ok: true,
      slot: docs
    })
    expect(
      pickSonarSlot([web, docs], { repoId: 'repo-web', worktreeId: A, slotId: 'web' })
    ).toEqual({ ok: true, slot: web })
    expect(pickSonarSlot([web, docs], { repoId: 'repo-web', worktreeId: A, port: 9999 })).toEqual({
      ok: false,
      reason: 'no-match',
      ports: [3000, 3001]
    })
  })

  it('prefers the slot serving the caller when asked to', () => {
    const servingDocs = { ...docs, worktreeId: A, phase: 'live' as const }
    expect(
      pickSonarSlot([web, servingDocs], { repoId: 'repo-web', worktreeId: A, preferServing: true })
    ).toEqual({ ok: true, slot: servingDocs })
    expect(pickSonarSlot([web, servingDocs], { repoId: 'repo-web', worktreeId: A })).toMatchObject({
      ok: false,
      reason: 'ambiguous'
    })
  })
})

describe('sonarConflict', () => {
  it('lets the caller take an idle slot or one it already serves', () => {
    expect(sonarConflict({ worktreeId: null, phase: 'idle' }, A, false)).toBeNull()
    expect(sonarConflict({ worktreeId: A, phase: 'live' }, A, false)).toBeNull()
  })

  it('refuses a slot another worktree holds, unless forced', () => {
    expect(sonarConflict({ worktreeId: B, phase: 'live' }, A, false)).toEqual({
      status: 'busy',
      worktreeId: B,
      phase: 'live'
    })
    expect(sonarConflict({ worktreeId: B, phase: 'crashed' }, null, false)).toMatchObject({
      status: 'busy'
    })
    expect(sonarConflict({ worktreeId: B, phase: 'live' }, A, true)).toBeNull()
  })
})

describe('sonarServeProgress', () => {
  it('waits while the caller is syncing or starting', () => {
    expect(sonarServeProgress(slot({ worktreeId: A, phase: 'syncing' }), A)).toEqual({
      kind: 'pending'
    })
    expect(sonarServeProgress(slot({ worktreeId: A, phase: 'starting' }), A)).toEqual({
      kind: 'pending'
    })
  })

  it('succeeds once the caller is live', () => {
    expect(sonarServeProgress(slot({ worktreeId: A, phase: 'live' }), A)).toEqual({ kind: 'live' })
  })

  it('fails with the error and the port owner', () => {
    const owner = { pid: 42, command: 'node', cwd: '/elsewhere' }
    expect(
      sonarServeProgress(
        slot({ worktreeId: A, phase: 'port-busy', error: 'Port 3000 is held', portOwner: owner }),
        A
      )
    ).toEqual({ kind: 'failed', reason: 'port-busy', error: 'Port 3000 is held', portOwner: owner })
  })

  it('fails as lost when the slot no longer serves the caller', () => {
    expect(sonarServeProgress(slot({ error: 'sync failed' }), A)).toEqual({
      kind: 'failed',
      reason: 'lost',
      error: 'sync failed',
      portOwner: null
    })
    expect(sonarServeProgress(slot({ worktreeId: B, phase: 'live' }), A)).toMatchObject({
      kind: 'failed',
      reason: 'lost'
    })
    expect(sonarServeProgress(undefined, A)).toMatchObject({ kind: 'failed', reason: 'lost' })
  })
})
