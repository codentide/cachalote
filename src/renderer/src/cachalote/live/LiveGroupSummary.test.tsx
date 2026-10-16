// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useWorktreeGroupsStore } from '../worktree-groups/worktree-groups-store'
import { liveSlotFixture } from './live-api-fixture'
import { liveLabel } from './live-labels'
import { callsTo, installLiveApi, removeLiveApi } from './live-test-harness'
import { LiveGroupMenuItem, LiveGroupSummary } from './LiveGroupSummary'

const APP = 'repo-app::/wt/app'
const BACKEND = 'repo-backend::/wt/backend'
const appSlot = liveSlotFixture({ repoId: 'repo-app', slotId: 'metro', port: 8081 })
const backendSlot = liveSlotFixture({ repoId: 'repo-backend', slotId: 'api', port: 8080 })

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function renderMenu(): void {
  render(
    <TooltipProvider>
      <ContextMenu>
        <ContextMenuTrigger>
          <span>header</span>
          <LiveGroupSummary groupId="g1" />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <LiveGroupMenuItem groupId="g1" />
        </ContextMenuContent>
      </ContextMenu>
    </TooltipProvider>
  )
}

beforeEach(() => {
  useWorktreeGroupsStore.setState({
    groups: { g1: { id: 'g1', name: 'Checkout' } },
    membership: { [APP]: 'g1', [BACKEND]: 'g1', 'repo-docs::/wt/docs': 'g1' },
    collapsed: {}
  })
})

afterEach(() => {
  cleanup()
  removeLiveApi()
})

describe('LiveGroupSummary', () => {
  it('shows live out of eligible members', async () => {
    installLiveApi({
      snapshot: {
        supported: true,
        slots: [{ ...appSlot, worktreeId: APP, phase: 'live' }, backendSlot]
      }
    })
    renderMenu()
    await settle()
    expect(screen.getByText('1/2')).toBeTruthy()
  })

  it('renders nothing while no member is live', async () => {
    installLiveApi({ snapshot: { supported: true, slots: [appSlot, backendSlot] } })
    renderMenu()
    await settle()
    expect(screen.queryByText(/\d\/\d/)).toBeNull()
  })

  it('renders nothing when no member has a slot', async () => {
    installLiveApi({ snapshot: { supported: true, slots: [] } })
    renderMenu()
    await settle()
    expect(screen.queryByText(/\d\/\d/)).toBeNull()
  })
})

describe('LiveGroupMenuItem', () => {
  it('projects every eligible member on its only slot', async () => {
    const fixture = installLiveApi({ snapshot: { supported: true, slots: [appSlot, backendSlot] } })
    renderMenu()
    await settle()
    fireEvent.contextMenu(screen.getByText('header'))
    fireEvent.click(await screen.findByRole('menuitem', { name: liveLabel('groupServe') }))
    await settle()
    expect(callsTo(fixture.calls, 'project')).toEqual([
      { repoId: 'repo-app', slotId: 'metro', worktreeId: APP },
      { repoId: 'repo-backend', slotId: 'api', worktreeId: BACKEND }
    ])
  })

  it('is disabled with a hint when a repo has several slots', async () => {
    const fixture = installLiveApi({
      snapshot: {
        supported: true,
        slots: [appSlot, liveSlotFixture({ repoId: 'repo-app', slotId: 'web', port: 3000 })]
      }
    })
    renderMenu()
    await settle()
    fireEvent.contextMenu(screen.getByText('header'))
    const item = await screen.findByRole('menuitem', { name: liveLabel('groupServe') })
    expect(item.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText(liveLabel('groupServeAmbiguous'))).toBeTruthy()
    fireEvent.click(item)
    expect(callsTo(fixture.calls, 'project')).toEqual([])
  })
})
