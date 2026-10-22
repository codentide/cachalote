import { useState } from 'react'
import { SquareTerminal } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useAppStore } from '@/store'
import {
  resolveTabSessionHistorySubject,
  type NativeChatTabSession
} from '@/components/tab-bar/tab-session-history-switch'
import { chatHandoffText } from './chat-handoff-text'
import { runCachaloteChatToTerminal, useCachaloteChatToTerminalPending } from './chat-to-terminal'

export function ChatToTerminalMenuItem({
  tab,
  nativeChat,
  onComplete
}: {
  tab: { id: string; worktreeId: string }
  nativeChat: NativeChatTabSession
  onComplete?: () => void
}): React.JSX.Element | null {
  const [subject] = useState(() =>
    resolveTabSessionHistorySubject(useAppStore.getState(), { tab, nativeChat })
  )
  const chat = subject?.kind === 'chat' ? subject : null
  const pending = useCachaloteChatToTerminalPending(chat?.sessionId ?? null)
  if (!chat || nativeChat.agent !== 'claude' || !window.api.cachaloteChatHandoff) {
    return null
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenuItem
          disabled={pending}
          aria-busy={pending}
          onSelect={(event) => {
            event.preventDefault()
            void runCachaloteChatToTerminal({ subject: chat, tab, onComplete })
          }}
        >
          {pending ? (
            <LoadingSpinner className="size-3.5" />
          ) : (
            <SquareTerminal className="size-3.5" />
          )}
          {chatHandoffText('chatToTerminal')}
        </DropdownMenuItem>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {chatHandoffText('chatToTerminalTooltip')}
      </TooltipContent>
    </Tooltip>
  )
}
