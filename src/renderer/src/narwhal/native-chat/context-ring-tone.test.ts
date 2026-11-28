import { describe, expect, it } from 'vitest'
import {
  NARWHAL_CONTEXT_TOKEN_LIMIT,
  narwhalContextRingBlinkClass,
  narwhalContextRingStyle
} from './context-ring-tone'

const LIMIT = NARWHAL_CONTEXT_TOKEN_LIMIT

describe('context ring tone', () => {
  it("keeps upstream's color through the first quarter of the limit", () => {
    expect(narwhalContextRingStyle(0)).toBeUndefined()
    expect(narwhalContextRingStyle(LIMIT * 0.24)).toBeUndefined()
    expect(narwhalContextRingStyle(Number.NaN)).toBeUndefined()
  })

  it('ramps from gray to amber, then amber to red, by absolute tokens', () => {
    expect(narwhalContextRingStyle(LIMIT * 0.25)?.color).toBe(
      'color-mix(in oklab, var(--status-warning) 0%, var(--muted-foreground))'
    )
    expect(narwhalContextRingStyle(LIMIT * 0.6)?.color).toBe(
      'color-mix(in oklab, var(--destructive) 0%, var(--status-warning))'
    )
    expect(narwhalContextRingStyle(LIMIT * 0.8)?.color).toBe(
      'color-mix(in oklab, var(--destructive) 50%, var(--status-warning))'
    )
  })

  it('is plain red and blinks from the limit on', () => {
    expect(narwhalContextRingStyle(LIMIT)).toEqual({ color: 'var(--destructive)' })
    expect(narwhalContextRingBlinkClass(LIMIT - 1)).toBe(false)
    expect(narwhalContextRingBlinkClass(LIMIT)).toBe('animate-pulse motion-reduce:animate-none')
  })
})
