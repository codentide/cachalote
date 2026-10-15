import { create } from 'zustand'
import { useWorktreeGroupsStore } from './worktree-groups-store'

/** The worktree group the create-worktree composer files its next worktree under. */
export type ComposerWorktreeGroupChoice =
  | { kind: 'none' }
  | { kind: 'existing'; groupId: string }
  // `token` sends every creation queued under one "new group" choice to the same group.
  | { kind: 'new'; name: string; token: string }

type BoundChoice = Exclude<ComposerWorktreeGroupChoice, { kind: 'none' }>

type ComposerWorktreeGroupState = {
  choice: ComposerWorktreeGroupChoice
  setChoice: (choice: ComposerWorktreeGroupChoice) => void
}

/** Lives only while the composer is open; not persisted. */
export const useComposerWorktreeGroupStore = create<ComposerWorktreeGroupState>()((set) => ({
  choice: { kind: 'none' },
  setChoice: (choice) => set({ choice })
}))

// Creation runs in the background, so the worktree id arrives after the composer has closed.
const choiceByCreationId = new Map<string, BoundChoice>()
const groupIdByNewToken = new Map<string, string>()

/** Remembers the composer's current choice for a creation that just started. */
export function bindComposerWorktreeGroup(creationId: string): void {
  const { choice } = useComposerWorktreeGroupStore.getState()
  if (choice.kind !== 'none') {
    choiceByCreationId.set(creationId, choice)
  }
}

/** Files a finished creation's worktree under the group chosen when it started. */
export function applyComposerWorktreeGroup(creationId: string, worktreeId: string): void {
  const choice = choiceByCreationId.get(creationId)
  if (!choice) {
    return
  }
  choiceByCreationId.delete(creationId)
  const groupsStore = useWorktreeGroupsStore.getState()
  if (choice.kind === 'existing') {
    groupsStore.addToGroup(choice.groupId, [worktreeId])
    return
  }
  const madeGroupId = groupIdByNewToken.get(choice.token)
  if (madeGroupId && groupsStore.groups[madeGroupId]) {
    groupsStore.addToGroup(madeGroupId, [worktreeId])
    return
  }
  const groupId = groupsStore.createGroup(choice.name, [worktreeId])
  groupIdByNewToken.set(choice.token, groupId)
  // A composer kept open by "create multiple" now offers the group it just made.
  const composer = useComposerWorktreeGroupStore.getState()
  if (composer.choice.kind === 'new' && composer.choice.token === choice.token) {
    composer.setChoice({ kind: 'existing', groupId })
  }
}
