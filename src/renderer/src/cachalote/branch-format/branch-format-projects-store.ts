import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { migrateStoredProjects, type ProjectBranchFormat } from './branch-format-settings'

type BranchFormatProjectsState = {
  /** repo id → the project's saved format; projects without one use their seed. */
  projects: Readonly<Record<string, ProjectBranchFormat>>
  saveProject: (repoId: string, format: ProjectBranchFormat) => void
  /** Drops the saved format so the project goes back to its seed. */
  resetProject: (repoId: string) => void
}

export const useBranchFormatProjectsStore = create<BranchFormatProjectsState>()(
  persist(
    (set) => ({
      projects: {},
      saveProject: (repoId, format) =>
        set((state) => ({ projects: { ...state.projects, [repoId]: format } })),
      resetProject: (repoId) =>
        set((state) => {
          const projects = { ...state.projects }
          delete projects[repoId]
          return { projects }
        })
    }),
    {
      name: 'cachalote:branch-format-projects',
      // v2: `{var}` placeholders and typed variables (v1: `{{var}}` and bare option lists).
      version: 2,
      migrate: (persisted) => ({ projects: migrateStoredProjects(persisted) }),
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ projects: state.projects })
    }
  )
)
