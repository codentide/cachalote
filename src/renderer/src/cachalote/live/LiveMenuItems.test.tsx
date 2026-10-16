// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { Worktree } from '../../../../shared/worktree/types'
import { liveSlotFixture } from './live-api-fixture'
import { liveLabel } from './live-labels'
import { callsTo, installLiveApi, removeLiveApi } from './live-test-harness'
import { LiveMenuItems } from './LiveMenuItems'

const WORKTREE = 'repo-1::/wt/a'

function worktree(id: string): Worktree {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the menu reads only id and repoId.
  return { id, repoId: 'repo-1' } as Worktree
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function openMenu(targets: Worktree[]): Promise<void> {
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <LiveMenuItems targets={targets} disabled={false} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
  await settle()
}

afterEach(() => {
  cleanup()
  removeLiveApi()
})

describe('LiveMenuItems', () => {
  it('serves the worktree on the only slot of its project', async () => {
    const fixture = installLiveApi({
      snapshot: { supported: true, slots: [liveSlotFixture({ port: 3000 })] }
    })
    await openMenu([worktree(WORKTREE)])
    fireEvent.click(
      await screen.findByRole('menuitem', { name: liveLabel('serveOn', { port: 3000 }) })
    )
    expect(callsTo(fixture.calls, 'project')).toEqual([
      { repoId: 'repo-1', slotId: 'web', worktreeId: WORKTREE }
    ])
  })

  it('offers a stop entry for the slot already serving it', async () => {
    const fixture = installLiveApi({
      snapshot: {
        supported: true,
        slots: [liveSlotFixture({ port: 3000, worktreeId: WORKTREE, phase: 'live' })]
      }
    })
    await openMenu([worktree(WORKTREE)])
    fireEvent.click(
      await screen.findByRole('menuitem', { name: liveLabel('stopServing', { port: 3000 }) })
    )
    expect(callsTo(fixture.calls, 'stop')).toEqual([{ repoId: 'repo-1', slotId: 'web' }])
    expect(
      screen.queryByRole('menuitem', { name: liveLabel('serveOn', { port: 3000 }) })
    ).toBeNull()
  })

  it('renders nothing for several targets or a project without slots', async () => {
    installLiveApi({ snapshot: { supported: true, slots: [liveSlotFixture()] } })
    await openMenu([worktree(WORKTREE), worktree('repo-1::/wt/b')])
    expect(screen.queryByRole('menuitem')).toBeNull()
    cleanup()
    installLiveApi({ snapshot: { supported: true, slots: [] } })
    await openMenu([worktree(WORKTREE)])
    expect(screen.queryByRole('menuitem')).toBeNull()
  })
})
