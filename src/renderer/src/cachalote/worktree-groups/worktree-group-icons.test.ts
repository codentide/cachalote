import { Bug, Layers } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { worktreeGroupIcon, worktreeGroupIconOptions } from './worktree-group-icons'

describe('worktree group icons', () => {
  it('resolves a stored id and falls back to the default for older or unknown ids', () => {
    expect(worktreeGroupIcon('bug')).toBe(Bug)
    expect(worktreeGroupIcon(undefined)).toBe(Layers)
    expect(worktreeGroupIcon('gone')).toBe(Layers)
  })

  it('offers a short set with unique ids', () => {
    const ids = worktreeGroupIconOptions().map((option) => option.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeLessThanOrEqual(12)
  })
})
