import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useWorktreeGroupsStore } from './worktree-groups-store'
import { worktreeGroupLabel } from './worktree-group-labels'

/** Single, sidebar-wide prompt for naming a new group or renaming one. */
export function WorktreeGroupNameDialog(): React.JSX.Element {
  const request = useWorktreeGroupsStore((s) => s.nameRequest)
  const requestName = useWorktreeGroupsStore((s) => s.requestName)
  const groups = useWorktreeGroupsStore((s) => s.groups)
  const createGroup = useWorktreeGroupsStore((s) => s.createGroup)
  const renameGroup = useWorktreeGroupsStore((s) => s.renameGroup)
  const initialName =
    request?.mode === 'rename'
      ? (groups[request.groupId]?.name ?? '')
      : worktreeGroupLabel('defaultName')
  const [name, setName] = useState(initialName)
  const [requestSeen, setRequestSeen] = useState(request)
  // Reset the field per request without an effect.
  if (requestSeen !== request) {
    setRequestSeen(request)
    setName(initialName)
  }

  const submit = (): void => {
    if (!request) {
      return
    }
    if (request.mode === 'create') {
      createGroup(name, request.worktreeIds)
    } else {
      renameGroup(request.groupId, name)
    }
    requestName(null)
  }

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && requestName(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {request?.mode === 'rename'
              ? worktreeGroupLabel('rename')
              : worktreeGroupLabel('newGroup')}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
          />
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={name.trim().length === 0}>
              {worktreeGroupLabel('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
