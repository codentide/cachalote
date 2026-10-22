import { useEffect } from 'react'
import { create } from 'zustand'

// Worktrees the sidebar shows inside a group folder; the rest of a group's members carry its badge.
type FolderMembersState = {
  inFolder: ReadonlySet<string>
  publish: (ids: ReadonlySet<string>) => void
}

export const useWorktreeGroupFolderMembers = create<FolderMembersState>()((set) => ({
  inFolder: new Set(),
  publish: (inFolder) => set({ inFolder })
}))

type RowLike = { type: string; worktreeIds?: readonly string[] }

export function folderMemberIds(rows: readonly RowLike[]): Set<string> {
  const ids = new Set<string>()
  for (const row of rows) {
    if (row.type === 'cachalote-worktree-group') {
      row.worktreeIds?.forEach((id) => ids.add(id))
    }
  }
  return ids
}

function sameIds(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((id) => right.has(id))
}

/** Publishes which worktrees the current row plan puts inside a group folder. */
export function usePublishWorktreeGroupFolderMembers(rows: readonly RowLike[]): void {
  useEffect(() => {
    const next = folderMemberIds(rows)
    const { inFolder, publish } = useWorktreeGroupFolderMembers.getState()
    if (!sameIds(inFolder, next)) {
      publish(next)
    }
  }, [rows])
}
