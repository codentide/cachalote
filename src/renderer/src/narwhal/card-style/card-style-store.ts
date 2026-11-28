import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type CardStyleState = {
  /** Draws Narwhal's cards over the experimental card layout; off falls back to upstream's. */
  narwhalCards: boolean
  setNarwhalCards: (enabled: boolean) => void
}

export const useNarwhalCardStyleStore = create<CardStyleState>()(
  persist(
    (set) => ({
      narwhalCards: false,
      setNarwhalCards: (enabled) => set({ narwhalCards: enabled })
    }),
    {
      name: 'narwhal:card-style',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ narwhalCards: state.narwhalCards })
    }
  )
)

export type CardStyleChoice = 'classic' | 'experimental' | 'narwhal'

/** The Card style control's value: Narwhal rides on the experimental layout. */
export function resolveCardStyleChoice(
  experimental: boolean,
  narwhalCards: boolean
): CardStyleChoice {
  if (!experimental) {
    return 'classic'
  }
  return narwhalCards ? 'narwhal' : 'experimental'
}
