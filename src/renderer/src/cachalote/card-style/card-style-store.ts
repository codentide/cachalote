import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type CardStyleState = {
  /** Draws Cachalote's cards over the experimental card layout; off falls back to upstream's. */
  cachaloteCards: boolean
  setCachaloteCards: (enabled: boolean) => void
}

export const useCachaloteCardStyleStore = create<CardStyleState>()(
  persist(
    (set) => ({
      cachaloteCards: false,
      setCachaloteCards: (enabled) => set({ cachaloteCards: enabled })
    }),
    {
      name: 'cachalote:card-style',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ cachaloteCards: state.cachaloteCards })
    }
  )
)

export type CardStyleChoice = 'classic' | 'experimental' | 'cachalote'

/** The Card style control's value: Cachalote rides on the experimental layout. */
export function resolveCardStyleChoice(
  experimental: boolean,
  cachaloteCards: boolean
): CardStyleChoice {
  if (!experimental) {
    return 'classic'
  }
  return cachaloteCards ? 'cachalote' : 'experimental'
}
