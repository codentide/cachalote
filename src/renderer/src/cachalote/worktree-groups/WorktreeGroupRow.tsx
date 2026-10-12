import { ChevronDown, Layers } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import { getWorktreeCardContentIndent } from '../../components/sidebar/worktree-list/rows/indentation'
import type { CachaloteWorktreeGroupRow } from './worktree-group-rows'
import { useWorktreeGroupsStore } from './worktree-groups-store'
import { AFTER_MENU_CLOSE_MS, worktreeGroupLabel } from './worktree-group-labels'

export function WorktreeGroupRow({
  row,
  isGrouped
}: {
  row: CachaloteWorktreeGroupRow
  /** False in the flat "None" view, which has no section indent to align with. */
  isGrouped: boolean
}): React.JSX.Element {
  const toggleCollapsed = useWorktreeGroupsStore((s) => s.toggleCollapsed)
  const requestName = useWorktreeGroupsStore((s) => s.requestName)
  const removeFromGroup = useWorktreeGroupsStore((s) => s.removeFromGroup)
  const membership = useWorktreeGroupsStore((s) => s.membership)
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
          onClick={() => toggleCollapsed(row.groupId)}
          onDoubleClick={() => rename(0)}
        >
          <ChevronDown
            className={cn('size-3.5 shrink-0 transition-transform', row.collapsed && '-rotate-90')}
          />
          <Layers className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
            {row.name}
          </span>
          <span className="shrink-0 text-xs tabular-nums">{row.count}</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => rename(AFTER_MENU_CLOSE_MS)}>
          {worktreeGroupLabel('rename')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={ungroup}>{worktreeGroupLabel('ungroup')}</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
