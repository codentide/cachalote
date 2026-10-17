import { describe, expect, it } from 'vitest'
import { liveSlotFixture } from './live-api-fixture'
import { buildSonarPanelSections, type SonarPanelInput } from './sonar-panel-model'
import { sonarRepo, sonarWorktree } from './sonar-panel-test-fixtures'

const admin = sonarRepo('admin', 'ax-admin')
const backend = sonarRepo('backend', 'ax-backend')
const app = sonarRepo('app', 'ax-app')
const adminMain = sonarWorktree('admin', 'main', { isMainWorktree: true })
const adminFix = sonarWorktree('admin', 'fix-login')
const adminCheckout = sonarWorktree('admin', 'checkout')
const backendMain = sonarWorktree('backend', 'main', { isMainWorktree: true })
const appMain = sonarWorktree('app', 'main', { isMainWorktree: true })

const web = liveSlotFixture({ repoId: 'admin', slotId: 'web', port: 3000 })
const docs = liveSlotFixture({ repoId: 'admin', slotId: 'docs', port: 3001 })
const api = liveSlotFixture({ repoId: 'backend', slotId: 'api', port: 8080 })
const metro = liveSlotFixture({ repoId: 'app', slotId: 'metro', port: 8081 })

const worktreesByRepo = {
  admin: [adminFix, adminCheckout, adminMain],
  backend: [backendMain],
  app: [appMain]
}

function build(input: Partial<SonarPanelInput>) {
  return buildSonarPanelSections({
    repos: [admin, backend, app],
    worktreesByRepo,
    slotsByRepo: {},
    standbyByRepo: {},
    activeWorktreeId: null,
    ...input
  })
}

describe('buildSonarPanelSections', () => {
  it('lists only projects with slots, the active worktree project first, then by name', () => {
    const sections = build({
      slotsByRepo: { backend: [api], app: [metro] },
      activeWorktreeId: backendMain.id
    })
    expect(sections.map((section) => section.name)).toEqual(['ax-backend', 'ax-app'])
  })

  it('skips slots of a project that is no longer in the sidebar', () => {
    const sections = build({ repos: [backend], slotsByRepo: { admin: [web], backend: [api] } })
    expect(sections.map((section) => section.repoId)).toEqual(['backend'])
  })

  it('lists only served and standby worktrees; the rest go to the menu, same order', () => {
    const [section] = build({
      repos: [admin],
      slotsByRepo: { admin: [docs, { ...web, worktreeId: adminFix.id, phase: 'live' }] },
      standbyByRepo: { admin: [adminMain.id] }
    })
    expect(section.slots.map((slot) => slot.port)).toEqual([3000, 3001])
    expect(section.worktrees.map((worktree) => worktree.name)).toEqual(['main', 'fix-login'])
    expect(section.others.map((worktree) => worktree.name)).toEqual(['checkout'])
  })

  it('marks serving worktrees as not standby and counts live slots', () => {
    const [section] = build({
      repos: [admin],
      slotsByRepo: {
        admin: [
          { ...web, worktreeId: adminFix.id, phase: 'live' },
          { ...docs, worktreeId: adminFix.id, phase: 'starting' }
        ]
      },
      standbyByRepo: { admin: [adminFix.id, adminCheckout.id] }
    })
    expect(section.worktrees).toMatchObject([
      { id: adminCheckout.id, servingSlotIds: [], standby: true },
      { id: adminFix.id, servingSlotIds: ['web', 'docs'], standby: false }
    ])
    expect(section.liveCount).toBe(1)
  })

  it('hides archived and removing worktrees from both lists', () => {
    const [section] = build({
      repos: [admin],
      worktreesByRepo: {
        admin: [adminMain, { ...adminFix, isArchived: true }, { ...adminCheckout, removing: true }]
      },
      slotsByRepo: { admin: [web] },
      standbyByRepo: { admin: [adminFix.id, adminCheckout.id] }
    })
    expect(section.worktrees).toEqual([])
    expect(section.others.map((worktree) => worktree.name)).toEqual(['main'])
  })

  it('ignores standby ids of worktrees that no longer exist', () => {
    const [section] = build({
      repos: [app],
      slotsByRepo: { app: [metro] },
      standbyByRepo: { app: ['app::/wt/gone'] }
    })
    expect(section.worktrees).toEqual([])
    expect(section.others.map((worktree) => worktree.id)).toEqual([appMain.id])
  })

  it('opens the active project and projects with a slot in use', () => {
    const sections = build({
      slotsByRepo: {
        admin: [web],
        backend: [{ ...api, worktreeId: backendMain.id, phase: 'crashed' }],
        app: [metro]
      },
      activeWorktreeId: adminFix.id
    })
    expect(
      Object.fromEntries(sections.map((section) => [section.name, section.startsOpen]))
    ).toEqual({ 'ax-admin': true, 'ax-backend': true, 'ax-app': false })
  })

  it('names a worktree by its folder when it has no display name', () => {
    const [section] = build({
      repos: [app],
      worktreesByRepo: { app: [{ ...appMain, displayName: '' }] },
      slotsByRepo: { app: [metro] },
      standbyByRepo: { app: [appMain.id] }
    })
    expect(section.worktrees[0].name).toBe('main')
  })
})
