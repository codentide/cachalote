import { describe, expect, it } from 'vitest'
import { migrateLegacyStorage } from './legacy-storage-migration'

type FakeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & {
  data: Map<string, string>
}

function fakeStorage(initial: Record<string, string> = {}): FakeStorage {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key)
  }
}

const PAIRS = [
  ['cachalote:worktree-groups', 'narwhal:worktree-groups'],
  ['cachalote:branch-format-choices', 'narwhal:branch-format-choices'],
  ['cachalote:branch-format-projects', 'narwhal:branch-format-projects']
] as const

describe('migrateLegacyStorage', () => {
  it('moves each legacy key to its Narwhal name', () => {
    const storage = fakeStorage(
      Object.fromEntries(PAIRS.map(([oldKey]) => [oldKey, `v:${oldKey}`]))
    )
    migrateLegacyStorage(storage)
    for (const [oldKey, newKey] of PAIRS) {
      expect(storage.getItem(newKey)).toBe(`v:${oldKey}`)
      expect(storage.getItem(oldKey)).not.toBeNull()
    }
  })

  it('renames cachaloteCards inside the card-style envelope and keeps the rest', () => {
    const storage = fakeStorage({
      'cachalote:card-style': JSON.stringify({
        state: { cachaloteCards: true, other: 1 },
        version: 1
      })
    })
    migrateLegacyStorage(storage)
    expect(storage.getItem('cachalote:card-style')).not.toBeNull()
    expect(JSON.parse(storage.getItem('narwhal:card-style')!)).toEqual({
      state: { narwhalCards: true, other: 1 },
      version: 1
    })
  })

  it('leaves both keys untouched when the new key already exists', () => {
    const storage = fakeStorage({
      'cachalote:worktree-groups': 'old',
      'narwhal:worktree-groups': 'new',
      'cachalote:card-style': '{"state":{"cachaloteCards":true},"version":1}',
      'narwhal:card-style': '{"state":{"narwhalCards":false},"version":1}'
    })
    const before = new Map(storage.data)
    migrateLegacyStorage(storage)
    expect(storage.data).toEqual(before)
  })

  it('does nothing when only the new key exists', () => {
    const storage = fakeStorage({ 'narwhal:worktree-groups': 'new' })
    migrateLegacyStorage(storage)
    expect([...storage.data]).toEqual([['narwhal:worktree-groups', 'new']])
  })

  it('is idempotent', () => {
    const storage = fakeStorage({
      'cachalote:card-style': '{"state":{"cachaloteCards":true},"version":1}',
      'cachalote:worktree-groups': 'old'
    })
    migrateLegacyStorage(storage)
    const afterFirst = new Map(storage.data)
    migrateLegacyStorage(storage)
    expect(storage.data).toEqual(afterFirst)
  })

  it('copies malformed card-style JSON as is', () => {
    const storage = fakeStorage({ 'cachalote:card-style': '{not json' })
    migrateLegacyStorage(storage)
    expect(storage.getItem('narwhal:card-style')).toBe('{not json')
    expect(storage.getItem('cachalote:card-style')).not.toBeNull()
  })

  it('does not throw when storage throws, and keeps the legacy value if the write failed', () => {
    const boom = (): never => {
      throw new Error('storage unavailable')
    }
    expect(() =>
      migrateLegacyStorage({ getItem: boom, setItem: boom, removeItem: boom })
    ).not.toThrow()

    const data = new Map([['cachalote:worktree-groups', 'old']])
    const failingWrite = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: boom,
      removeItem: (key: string) => void data.delete(key)
    }
    expect(() => migrateLegacyStorage(failingWrite)).not.toThrow()
    expect(data.get('cachalote:worktree-groups')).toBe('old')
  })
})
