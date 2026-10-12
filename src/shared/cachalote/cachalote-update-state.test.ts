import { describe, expect, it } from 'vitest'
import { toChangeTitle } from './cachalote-update-state'

describe('toChangeTitle', () => {
  it('drops the sha and the conventional prefix, and capitalizes', () => {
    expect(toChangeTitle('3d93ed5d74 feat(cachalote): color for worktree groups')).toBe(
      'Color for worktree groups'
    )
  })

  it('handles prefixes without a scope, breaking markers and plain subjects', () => {
    expect(toChangeTitle('51dfcd7 fix: route update checks')).toBe('Route update checks')
    expect(toChangeTitle('abcdef1 feat(x)!: drop flag')).toBe('Drop flag')
    expect(toChangeTitle('abcdef1 Sperm whale icon')).toBe('Sperm whale icon')
  })
})
