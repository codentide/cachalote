import { Check, ChevronDown } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import { getWorkspaceStatusColorOptions } from '../../components/sidebar/workspace-status'
import { getWorktreeCardContentIndent } from '../../components/sidebar/worktree-list/rows/indentation'
import type { CachaloteWorktreeGroupRow } from './worktree-group-rows'
import { useWorktreeGroupsStore } from './worktree-groups-store'
import { AFTER_MENU_CLOSE_MS, worktreeGroupLabel } from './worktree-group-labels'
import {
  DEFAULT_WORKTREE_GROUP_ICON,
  WorktreeGroupIcon,
  worktreeGroupIconCategories
} from './worktree-group-icons'
import { writeWorkspaceDragData } from '../../components/sidebar/workspace-status-drag-data'
import type { DraggedWorktreeCopies } from '../../components/sidebar/worktree-list/drag/dragged-worktree-copies'
import { useAppStore } from '@/store'
import { LiveGroupMenuItem, LiveGroupSummary } from '../live/LiveGroupSummary'

type CardDragStart = (
  event: React.DragEvent<HTMLDivElement>,
  worktreeId: string,
  draggedCopies: DraggedWorktreeCopies
) => void

// The members as the sidebar's own card drag carries them, so the drop targets treat them alike.
function memberCopies(worktreeIds: readonly string[]): DraggedWorktreeCopies {
  const all = Object.values(useAppStore.getState().worktreesByRepo).flat()
  return worktreeIds.flatMap((id) => {
    const worktree = all.find((candidate) => candidate.id === id)
    return worktree ? [{ id: worktree.id, hostId: worktree.hostId }] : []
  })
}

export function WorktreeGroupRow({
  row,
  isGrouped,
  onDragStart,
  onDragEnd
}: {
  row: CachaloteWorktreeGroupRow
  /** False in the flat "None" view, which has no section indent to align with. */
  isGrouped: boolean
  /** The sidebar's card drag session, so status sections and rows accept the folder. */
  onDragStart?: CardDragStart
  onDragEnd?: () => void
}): React.JSX.Element {
  const toggleCollapsed = useWorktreeGroupsStore((s) => s.toggleCollapsed)
  const requestName = useWorktreeGroupsStore((s) => s.requestName)
  const removeFromGroup = useWorktreeGroupsStore((s) => s.removeFromGroup)
  const setGroupColor = useWorktreeGroupsStore((s) => s.setGroupColor)
  const setGroupIcon = useWorktreeGroupsStore((s) => s.setGroupIcon)
  const membership = useWorktreeGroupsStore((s) => s.membership)
  const colorOptions = getWorkspaceStatusColorOptions()
  // Groups saved before colors existed keep the old muted look.
  const tone = colorOptions.find((option) => option.id === row.color)?.tone
  const paddingLeft = getWorktreeCardContentIndent({
    isGrouped,
    groupDepth: row.groupDepth,
    lineageDepth: 0
  })
  const rename = (delayMs: number): void => {
    window.setTimeout(() => requestName({ mode: 'rename', groupId: row.groupId }), delayMs)
  }
  // Ungroup every member, not only the ones visible in this section.
  const ungroup = (): void => {
    removeFromGroup(
      Object.entries(membership)
        .filter(([, groupId]) => groupId === row.groupId)
        .map(([worktreeId]) => worktreeId)
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button"
          tabIndex={-1}
          aria-expanded={!row.collapsed}
          className="flex h-[30px] w-full cursor-pointer items-center gap-1.5 pr-2 text-muted-foreground transition-colors hover:text-foreground"
          style={{ paddingLeft }}
          // Dropped on a status, the folder moves the members it shows in this section.
          draggable
          onDragStart={(event) => {
            const copies = memberCopies(row.worktreeIds)
            const first = copies[0]
            if (!first) {
              event.preventDefault()
              return
            }
            writeWorkspaceDragData(
              event.dataTransfer,
              copies.map((copy) => copy.id)
            )
            onDragStart?.(event, first.id, copies)
          }}
          onDragEnd={() => onDragEnd?.()}
          onClick={() => toggleCollapsed(row.groupId)}
          onDoubleClick={() => rename(0)}
        >
          <ChevronDown
            className={cn('size-3.5 shrink-0 transition-transform', row.collapsed && '-rotate-90')}
          />
          <WorktreeGroupIcon icon={row.icon} className={cn('size-3.5 shrink-0', tone)} />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
            {row.name}
          </span>
          <LiveGroupSummary groupId={row.groupId} />
          <span className="shrink-0 text-xs tabular-nums">{row.count}</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => rename(AFTER_MENU_CLOSE_MS)}>
          {worktreeGroupLabel('rename')}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>{worktreeGroupLabel('color')}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {colorOptions.map((option) => (
              <ContextMenuItem
                key={option.id}
                onSelect={() => setGroupColor(row.groupId, option.id)}
              >
                <span className={cn('size-2.5 shrink-0 rounded-full', option.swatch)} />
                <span className="flex-1">{option.label}</span>
                {option.id === row.color ? <Check className="size-3.5" /> : null}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>{worktreeGroupLabel('icon')}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {worktreeGroupIconCategories().map((category) => (
              <ContextMenuSub key={category.id}>
                <ContextMenuSubTrigger>{category.label}</ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {category.icons.map(({ id, label }) => (
                    <ContextMenuItem key={id} onSelect={() => setGroupIcon(row.groupId, id)}>
                      <WorktreeGroupIcon icon={id} className="size-3.5 shrink-0" />
                      <span className="flex-1">{label}</span>
                      {id === (row.icon ?? DEFAULT_WORKTREE_GROUP_ICON) ? (
                        <Check className="size-3.5" />
                      ) : null}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <LiveGroupMenuItem groupId={row.groupId} />
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={ungroup}>{worktreeGroupLabel('ungroup')}</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
