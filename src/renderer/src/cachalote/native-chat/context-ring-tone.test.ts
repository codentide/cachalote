import { describe, expect, it } from 'vitest'
import {
  CACHALOTE_CONTEXT_TOKEN_LIMIT,
  cachaloteContextRingBlinkClass,
  cachaloteContextRingStyle
} from './context-ring-tone'

const LIMIT = CACHALOTE_CONTEXT_TOKEN_LIMIT

describe('context ring tone', () => {
  it("keeps upstream's color through the first quarter of the limit", () => {
    expect(cachaloteContextRingStyle(0)).toBeUndefined()
    expect(cachaloteContextRingStyle(LIMIT * 0.24)).toBeUndefined()
    expect(cachaloteContextRingStyle(Number.NaN)).toBeUndefined()
  })

  it('ramps from gray to amber, then amber to red, by absolute tokens', () => {
    expect(cachaloteContextRingStyle(LIMIT * 0.25)?.color).toBe(
      'color-mix(in oklab, var(--status-warning) 0%, var(--muted-foreground))'
    )
    expect(cachaloteContextRingStyle(LIMIT * 0.6)?.color).toBe(
      'color-mix(in oklab, var(--destructive) 0%, var(--status-warning))'
    )
    expect(cachaloteContextRingStyle(LIMIT * 0.8)?.color).toBe(
      'color-mix(in oklab, var(--destructive) 50%, var(--status-warning))'
    )
  })

  it('is plain red and blinks from the limit on', () => {
    expect(cachaloteContextRingStyle(LIMIT)).toEqual({ color: 'var(--destructive)' })
    expect(cachaloteContextRingBlinkClass(LIMIT - 1)).toBe(false)
    expect(cachaloteContextRingBlinkClass(LIMIT)).toBe('animate-pulse motion-reduce:animate-none')
  })
})
