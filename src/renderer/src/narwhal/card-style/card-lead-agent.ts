import type { AgentDotState } from '@/components/agent/status/AgentStateDot'
import type { DashboardAgentRow } from '@/components/dashboard/rows/dashboard-agent-row'
import { SUMMARY_STATE_ORDER } from '@/components/sidebar/workspace-card/activity/worktree-card-agent-summary'
import { agentRowDisplayDotState } from '../../../../shared/agent-row-dot-state'

// Upstream's summary order leaves out permission; an approval prompt outranks everything else.
const LEAD_STATE_ORDER: readonly AgentDotState[] = ['permission', ...SUMMARY_STATE_ORDER]

export type CardLeadAgent = {
  agent: DashboardAgentRow
  state: AgentDotState
  /** Other root agents on the card, shown as "+N". */
  othersCount: number
}

function rank(state: AgentDotState): number {
  const index = LEAD_STATE_ORDER.indexOf(state)
  return index === -1 ? LEAD_STATE_ORDER.length : index
}

/** The agent whose state speaks for the card: the one that most needs the user, newest on ties. */
export function pickCardLeadAgent(rows: readonly DashboardAgentRow[]): CardLeadAgent | null {
  const roots = rows.filter((row) => row.rowSource !== 'subagent')
  let lead: { agent: DashboardAgentRow; state: AgentDotState } | null = null
  for (const agent of roots) {
    const state = agentRowDisplayDotState(agent)
    if (
      !lead ||
      rank(state) < rank(lead.state) ||
      (rank(state) === rank(lead.state) && agent.entry.updatedAt > lead.agent.entry.updatedAt)
    ) {
      lead = { agent, state }
    }
  }
  return lead ? { ...lead, othersCount: roots.length - 1 } : null
}
