import { useEffect } from 'react'
import { create } from 'zustand'

// Worktrees the sidebar shows inside a group folder; the rest of a group's members carry its badge.
type FolderMembersState = {
  inFolder: ReadonlySet<string>
  /** Worktree id → its open folder and whether it is the folder's last row; feeds the tree guides. */
  positions: ReadonlyMap<string, FolderMemberPosition>
  publish: (ids: ReadonlySet<string>, positions: ReadonlyMap<string, FolderMemberPosition>) => void
}

export type FolderMemberPosition = { groupId: string; last: boolean }

export const useWorktreeGroupFolderMembers = create<FolderMembersState>()((set) => ({
  inFolder: new Set(),
  positions: new Map(),
  publish: (inFolder, positions) => set({ inFolder, positions })
}))

type RowLike = {
  type: string
  worktreeIds?: readonly string[]
  groupId?: string
  collapsed?: boolean
}

export function folderMemberIds(rows: readonly RowLike[]): Set<string> {
  const ids = new Set<string>()
  for (const row of rows) {
    if (row.type === 'narwhal-worktree-group') {
      row.worktreeIds?.forEach((id) => ids.add(id))
    }
  }
  return ids
}

/** Where each member of an open folder sits: members render right after the header, in order. */
export function folderMemberPositions(rows: readonly RowLike[]): Map<string, FolderMemberPosition> {
  const positions = new Map<string, FolderMemberPosition>()
  for (const row of rows) {
    const groupId = row.groupId
    if (row.type !== 'narwhal-worktree-group' || row.collapsed || !groupId) {
      continue
    }
    const ids = row.worktreeIds ?? []
    ids.forEach((id, index) => positions.set(id, { groupId, last: index === ids.length - 1 }))
  }
  return positions
}

function samePositions(
  left: ReadonlyMap<string, FolderMemberPosition>,
  right: ReadonlyMap<string, FolderMemberPosition>
): boolean {
  return (
    left.size === right.size &&
    [...left].every(([id, position]) => {
      const other = right.get(id)
      return other?.groupId === position.groupId && other.last === position.last
    })
  )
}

function sameIds(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((id) => right.has(id))
}

/** Publishes which worktrees the current row plan puts inside a group folder. */
export function usePublishWorktreeGroupFolderMembers(rows: readonly RowLike[]): void {
  useEffect(() => {
    const next = folderMemberIds(rows)
    const nextPositions = folderMemberPositions(rows)
    const { inFolder, positions, publish } = useWorktreeGroupFolderMembers.getState()
    if (!sameIds(inFolder, next) || !samePositions(positions, nextPositions)) {
      publish(next, nextPositions)
    }
  }, [rows])
}
