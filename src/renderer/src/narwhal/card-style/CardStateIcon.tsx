import React from 'react'
import {
  Activity,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleStop,
  LoaderCircle,
  MessageCircleQuestionMark,
  Moon,
  OctagonPause,
  OctagonX,
  Unplug,
  type LucideIcon
} from 'lucide-react'

import { agentStateLabel, type AgentDotState } from '@/components/agent/status/AgentStateDot'
import { cn } from '@/lib/class-names'

// Shape carries the state on its own; color backs it up. The tooltip names it.
const STATE_ICONS: Record<AgentDotState, { icon: LucideIcon; className: string }> = {
  permission: { icon: CircleAlert, className: 'text-orange-500' },
  waiting: { icon: MessageCircleQuestionMark, className: 'text-agent-question' },
  blocked: { icon: OctagonPause, className: 'text-amber-500' },
  failed: { icon: OctagonX, className: 'text-red-500' },
  working: { icon: LoaderCircle, className: 'animate-spin text-agent-working' },
  monitoring: { icon: Activity, className: 'text-agent-working' },
  unconfirmed: { icon: CircleDashed, className: 'text-amber-500' },
  interrupted: { icon: CircleStop, className: 'text-muted-foreground' },
  done: { icon: CircleCheck, className: 'text-emerald-500' },
  unverifiable: { icon: Unplug, className: 'text-muted-foreground/70' },
  idle: { icon: Moon, className: 'text-muted-foreground/70' }
}

export function CardStateIcon({ state }: { state: AgentDotState }): React.JSX.Element {
  const { icon: Icon, className } = STATE_ICONS[state]
  const label = agentStateLabel(state)
  return (
    <span className="inline-flex shrink-0" title={label}>
      <Icon className={cn('size-[13px]', className)} aria-label={label} />
    </span>
  )
}
