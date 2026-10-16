import { Radio, Square } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import type { Worktree } from '../../../../shared/worktree/types'
import { liveLabel } from './live-labels'
import { decideLiveMenu } from './live-menu-model'
import { liveActions, useLiveStore, useLiveStoreStarted } from './live-store'

/** Worktree context menu items: serve it on a slot of its project, or stop serving it. */
export function LiveMenuItems({
  targets,
  disabled
}: {
  targets: readonly Worktree[]
  disabled: boolean
}): React.JSX.Element | null {
  useLiveStoreStarted()
  const slots = useLiveStore((s) => s.slots)
  const decision = decideLiveMenu(targets, slots)
  const [target] = targets
  if (!decision || !target) {
    return null
  }
  const { serving, projectable } = decision
  const [onlySlot] = projectable
  const projectOn = (slot: (typeof projectable)[number]): void => {
    void liveActions.project({
      repoId: slot.repoId,
      slotId: slot.slotId,
      worktreeId: target.id
    })
  }

  return (
    <>
      {serving.map((slot) => (
        <DropdownMenuItem
          key={`stop:${slot.slotId}`}
          disabled={disabled}
          onSelect={() => void liveActions.stop({ repoId: slot.repoId, slotId: slot.slotId })}
        >
          <Square className="size-3.5" />
          {liveLabel('stopServing', { port: slot.port })}
        </DropdownMenuItem>
      ))}
      {projectable.length === 1 && onlySlot ? (
        <DropdownMenuItem disabled={disabled} onSelect={() => projectOn(onlySlot)}>
          <Radio className="size-3.5" />
          {liveLabel('serveOn', { port: onlySlot.port })}
        </DropdownMenuItem>
      ) : null}
      {projectable.length > 1 ? (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={disabled}>
            <Radio className="size-3.5" />
            {liveLabel('serveOnMenu')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {projectable.map((slot) => (
              <DropdownMenuItem key={slot.slotId} onSelect={() => projectOn(slot)}>
                {`${slot.label} :${slot.port}`}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : null}
      {/* Keeps the parent-worktree actions below visually apart from these. */}
      <DropdownMenuSeparator />
    </>
  )
}
