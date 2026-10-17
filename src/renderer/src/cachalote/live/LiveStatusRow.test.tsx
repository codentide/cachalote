// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { liveSlotFixture } from './live-api-fixture'
import { liveLabel } from './live-labels'
import { LiveStatusRow } from './LiveStatusRow'
import { formatUptime } from './live-slot-presentation'

afterEach(cleanup)

describe('LiveStatusRow optional props', () => {
  it('omits the project name when undefined', () => {
    render(<LiveStatusRow slot={liveSlotFixture()} worktrees={[]} projectName={undefined} />)
    expect(screen.queryByText('Project')).toBeNull()
    render(<LiveStatusRow slot={liveSlotFixture()} worktrees={[]} projectName="Project" />)
    expect(screen.getByText('Project')).toBeTruthy()
  })

  it('hides the change dropdown with showChange={false}', () => {
    render(<LiveStatusRow slot={liveSlotFixture()} worktrees={[]} showChange={false} />)
    expect(screen.queryByText(liveLabel('change'))).toBeNull()
  })

  it('renders extra actions', () => {
    render(
      <LiveStatusRow
        slot={liveSlotFixture()}
        worktrees={[]}
        extraActions={<button type="button">extra</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'extra' })).toBeTruthy()
  })

  it('computes the uptime from the given clock', () => {
    const slot = liveSlotFixture({ phase: 'live', startedAt: 1000 })
    const now = 1000 + 3 * 3600_000
    render(<LiveStatusRow slot={slot} worktrees={[]} now={now} />)
    expect(
      screen.getByText(new RegExp(liveLabel('uptime', { time: formatUptime(1000, now) })))
    ).toBeTruthy()
  })
})
