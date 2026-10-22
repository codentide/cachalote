import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createBrowserUuid } from '@/lib/browser-uuid'

/** `color` is a workspace-status color id, `icon` an id from worktree-group-icons; older groups lack them. */
export type WorktreeGroup = { id: string; name: string; color?: string; icon?: string }

// Vivid status colors only, so a new group never looks like a neutral or "done" lane.
export const WORKTREE_GROUP_COLOR_ROTATION = ['blue', 'violet', 'emerald', 'amber', 'rose', 'sky']

/** What the sidebar row builder reads; kept separate from actions so rows rebuild only on data changes. */
export type WorktreeGroupsView = {
  groups: Readonly<Record<string, WorktreeGroup>>
  /** worktree id → group id */
  membership: Readonly<Record<string, string>>
  /** group ids collapsed in every section they appear in */
  collapsed: Readonly<Record<string, true>>
}

export type WorktreeGroupNameRequest =
  | { mode: 'create'; worktreeIds: readonly string[] }
  | { mode: 'rename'; groupId: string }

type WorktreeGroupsState = WorktreeGroupsView & {
  /** Pending name prompt; not persisted. */
  nameRequest: WorktreeGroupNameRequest | null
  requestName: (request: WorktreeGroupNameRequest | null) => void
  createGroup: (name: string, worktreeIds: readonly string[]) => string
  addToGroup: (groupId: string, worktreeIds: readonly string[]) => void
  removeFromGroup: (worktreeIds: readonly string[]) => void
  renameGroup: (groupId: string, name: string) => void
  setGroupColor: (groupId: string, color: string) => void
  setGroupIcon: (groupId: string, icon: string) => void
  toggleCollapsed: (groupId: string) => void
}

// A group exists only through its members; dropping the last one drops the group.
function pruneEmptyGroups(
  view: WorktreeGroupsView
): Pick<WorktreeGroupsView, 'groups' | 'collapsed'> {
  const used = new Set(Object.values(view.membership))
  const groups: Record<string, WorktreeGroup> = {}
  const collapsed: Record<string, true> = {}
  for (const [id, group] of Object.entries(view.groups)) {
    if (used.has(id)) {
      groups[id] = group
      if (view.collapsed[id]) {
        collapsed[id] = true
      }
    }
  }
  return { groups, collapsed }
}

export const useWorktreeGroupsStore = create<WorktreeGroupsState>()(
  persist(
    (set) => ({
      groups: {},
      membership: {},
      collapsed: {},
      nameRequest: null,
      requestName: (nameRequest) => set({ nameRequest }),
      createGroup: (name, worktreeIds) => {
        const id = createBrowserUuid()
        set((state) => {
          const membership = { ...state.membership }
          for (const worktreeId of worktreeIds) {
            membership[worktreeId] = id
          }
          const color =
            WORKTREE_GROUP_COLOR_ROTATION[
              Object.keys(state.groups).length % WORKTREE_GROUP_COLOR_ROTATION.length
            ]
          const groups = {
            ...state.groups,
            [id]: { id, name: name.trim() || 'Untitled group', color }
          }
          return { membership, ...pruneEmptyGroups({ ...state, groups, membership }) }
        })
        return id
      },
      addToGroup: (groupId, worktreeIds) =>
        set((state) => {
          if (!state.groups[groupId]) {
            return state
          }
          const membership = { ...state.membership }
          for (const worktreeId of worktreeIds) {
            membership[worktreeId] = groupId
          }
          return { membership, ...pruneEmptyGroups({ ...state, membership }) }
        }),
      removeFromGroup: (worktreeIds) =>
        set((state) => {
          const membership = { ...state.membership }
          for (const worktreeId of worktreeIds) {
            delete membership[worktreeId]
          }
          return { membership, ...pruneEmptyGroups({ ...state, membership }) }
        }),
      renameGroup: (groupId, name) =>
        set((state) => {
          const group = state.groups[groupId]
          const trimmed = name.trim()
          return group && trimmed
            ? { groups: { ...state.groups, [groupId]: { ...group, name: trimmed } } }
            : state
        }),
      setGroupColor: (groupId, color) =>
        set((state) => {
          const group = state.groups[groupId]
          return group ? { groups: { ...state.groups, [groupId]: { ...group, color } } } : state
        }),
      setGroupIcon: (groupId, icon) =>
        set((state) => {
          const group = state.groups[groupId]
          return group ? { groups: { ...state.groups, [groupId]: { ...group, icon } } } : state
        }),
      toggleCollapsed: (groupId) =>
        set((state) => {
          const collapsed = { ...state.collapsed }
          if (collapsed[groupId]) {
            delete collapsed[groupId]
          } else {
            collapsed[groupId] = true
          }
          return { collapsed }
        })
    }),
    {
      name: 'cachalote:worktree-groups',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        groups: state.groups,
        membership: state.membership,
        collapsed: state.collapsed
      })
    }
  )
)
