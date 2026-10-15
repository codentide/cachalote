import { useEffect, useId } from 'react'
import { Layers, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { cn } from '@/lib/utils'
import { getWorkspaceStatusColorOptions } from '../../components/sidebar/workspace-status'
import { useComposerWorktreeGroupStore } from './composer-worktree-group'
import { useWorktreeGroupsStore } from './worktree-groups-store'
import { worktreeGroupLabel } from './worktree-group-labels'

const NO_GROUP = '__cachalote-no-group__'
const NEW_GROUP = '__cachalote-new-group__'

/** Picks the worktree group a worktree created from the composer lands in. */
export function ComposerWorktreeGroupField(): React.JSX.Element {
  const labelId = useId()
  const groups = useWorktreeGroupsStore((s) => s.groups)
  const choice = useComposerWorktreeGroupStore((s) => s.choice)
  const setChoice = useComposerWorktreeGroupStore((s) => s.setChoice)
  // The choice belongs to this composer session; the next one starts ungrouped.
  useEffect(() => () => setChoice({ kind: 'none' }), [setChoice])

  const colorOptions = getWorkspaceStatusColorOptions()
  const sortedGroups = Object.values(groups).sort((left, right) =>
    left.name.localeCompare(right.name)
  )
  const value =
    choice.kind === 'new'
      ? NEW_GROUP
      : choice.kind === 'existing' && groups[choice.groupId]
        ? choice.groupId
        : NO_GROUP

  const handleValueChange = (next: string): void => {
    if (next === NO_GROUP) {
      setChoice({ kind: 'none' })
    } else if (next === NEW_GROUP) {
      setChoice({
        kind: 'new',
        name: worktreeGroupLabel('defaultName'),
        token: createBrowserUuid()
      })
    } else {
      setChoice({ kind: 'existing', groupId: next })
    }
  }

  return (
    <div className="space-y-1.5">
      <span id={labelId} className="block text-xs font-medium text-muted-foreground">
        {worktreeGroupLabel('composerField')}
      </span>
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger aria-labelledby={labelId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_GROUP}>{worktreeGroupLabel('noGroup')}</SelectItem>
          <SelectItem value={NEW_GROUP}>
            <Plus className="size-3.5" />
            {worktreeGroupLabel('newGroupOption')}
          </SelectItem>
          {sortedGroups.length > 0 ? <SelectSeparator /> : null}
          {sortedGroups.map((group) => (
            <SelectItem key={group.id} value={group.id}>
              <Layers
                className={cn(
                  'size-3.5',
                  colorOptions.find((option) => option.id === group.color)?.tone
                )}
              />
              {group.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {choice.kind === 'new' ? (
        <Input
          autoFocus
          aria-label={worktreeGroupLabel('groupName')}
          placeholder={worktreeGroupLabel('groupName')}
          value={choice.name}
          onChange={(event) => setChoice({ ...choice, name: event.target.value })}
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  )
}
