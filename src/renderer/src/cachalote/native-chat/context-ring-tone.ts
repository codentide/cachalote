import type { CSSProperties } from 'react'

/** Same limit as the terminal status line: past it the context is worth compacting. */
export const CACHALOTE_CONTEXT_TOKEN_LIMIT = 350_000

// The status line's ramp: gray for the first quarter, amber by the middle, red at the limit.
const GRAY_UNTIL = 0.25
const AMBER_AT = 0.6

const mix = (from: string, to: string, share: number): string =>
  `color-mix(in oklab, var(${to}) ${Math.round(share * 100)}%, var(${from}))`

/** Ring color by absolute tokens, so a 1M window warns as early as a 200k one; undefined keeps upstream's. */
export function cachaloteContextRingStyle(usedTokens: number): CSSProperties | undefined {
  const share = usedTokens / CACHALOTE_CONTEXT_TOKEN_LIMIT
  if (!(share >= GRAY_UNTIL)) {
    return undefined
  }
  if (share >= 1) {
    return { color: 'var(--destructive)' }
  }
  if (share < AMBER_AT) {
    const toAmber = (share - GRAY_UNTIL) / (AMBER_AT - GRAY_UNTIL)
    return { color: mix('--muted-foreground', '--status-warning', toAmber) }
  }
  return { color: mix('--status-warning', '--destructive', (share - AMBER_AT) / (1 - AMBER_AT)) }
}

/** Past the limit the ring blinks, as the status line does; never under reduced motion. */
export function cachaloteContextRingBlinkClass(usedTokens: number): string | false {
  return usedTokens >= CACHALOTE_CONTEXT_TOKEN_LIMIT && 'animate-pulse motion-reduce:animate-none'
}
