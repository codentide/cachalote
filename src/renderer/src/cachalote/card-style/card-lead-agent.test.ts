import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { AgentRowState } from '../../../../shared/agent-status/presentation/agent-row-decay-state'
import type { DashboardAgentRow } from '@/components/dashboard/rows/dashboard-agent-row'
import { pickCardLeadAgent } from './card-lead-agent'

function makeRow(
  paneKey: string,
  state: AgentRowState,
  updatedAt: number,
  rowSource?: 'subagent'
): DashboardAgentRow {
  const entry: AgentStatusEntry = {
    paneKey,
    state: state === 'waiting' ? 'waiting' : state === 'working' ? 'working' : 'done',
    prompt: paneKey,
    updatedAt,
    stateStartedAt: updatedAt,
    stateHistory: [],
    agentType: 'claude'
  }
  return {
    paneKey,
    entry,
    tab: {
      id: paneKey,
      worktreeId: 'wt-1',
      ptyId: null,
      title: 'Agent',
      customTitle: null,
      color: null,
      sortOrder: 0,
      createdAt: 0
    },
    agentType: 'claude',
    state,
    startedAt: updatedAt,
    ...(rowSource ? { rowSource } : {})
  }
}

describe('pickCardLeadAgent', () => {
  it('leads with the agent waiting on the user over working and done ones', () => {
    const lead = pickCardLeadAgent([
      makeRow('done', 'done', 3000),
      makeRow('working', 'working', 2000),
      makeRow('waiting', 'waiting', 1000)
    ])
    expect(lead?.agent.paneKey).toBe('waiting')
    expect(lead?.state).toBe('waiting')
    expect(lead?.othersCount).toBe(2)
  })

  it('breaks ties by the newest update and ignores subagent rows', () => {
    const lead = pickCardLeadAgent([
      makeRow('older', 'working', 1000),
      makeRow('newer', 'working', 2000),
      makeRow('child', 'waiting', 3000, 'subagent')
    ])
    expect(lead?.agent.paneKey).toBe('newer')
    expect(lead?.othersCount).toBe(1)
  })

  it('has no lead without agents', () => {
    expect(pickCardLeadAgent([])).toBeNull()
  })
})
