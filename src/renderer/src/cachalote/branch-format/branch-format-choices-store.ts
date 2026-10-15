import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type BranchFormatChoicesState = {
  /** repo id → variable → last value picked; a country or type tends to repeat per repo. */
  choices: Readonly<Record<string, Readonly<Record<string, string>>>>
  setChoice: (repoId: string, variable: string, value: string) => void
}

export const useBranchFormatChoicesStore = create<BranchFormatChoicesState>()(
  persist(
    (set) => ({
      choices: {},
      setChoice: (repoId, variable, value) =>
        set((state) => ({
          choices: {
            ...state.choices,
            [repoId]: { ...state.choices[repoId], [variable]: value }
          }
        }))
    }),
    {
      name: 'cachalote:branch-format-choices',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ choices: state.choices })
    }
  )
)
