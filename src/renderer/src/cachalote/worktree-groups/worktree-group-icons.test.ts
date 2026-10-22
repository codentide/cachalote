import { Bug, Layers } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import {
  worktreeGroupIcon,
  worktreeGroupIconCategories,
  worktreeGroupIconOptions
} from './worktree-group-icons'

describe('worktree group icons', () => {
  it('resolves a stored id and falls back to the default for older or unknown ids', () => {
    expect(worktreeGroupIcon('bug')).toBe(Bug)
    expect(worktreeGroupIcon(undefined)).toBe(Layers)
    expect(worktreeGroupIcon('gone')).toBe(Layers)
  })

  it('offers every option once', () => {
    const ids = worktreeGroupIconOptions().map((option) => option.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('worktree group icon categories', () => {
  it('keeps every shipped id and files each icon under one category', () => {
    const categories = worktreeGroupIconCategories()
    const ids = categories.flatMap((category) => category.icons.map((icon) => icon.id))
    expect(ids).toEqual(expect.arrayContaining(['layers', 'bug', 'zap', 'dumbbell', 'credit-card']))
    expect(new Set(ids).size).toBe(ids.length)
    expect(categories.every((category) => category.icons.length > 0)).toBe(true)
  })
})
