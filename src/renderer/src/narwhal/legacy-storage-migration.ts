// Import-free on purpose: it must evaluate before the persisted stores hydrate from localStorage.
type LegacyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

type LegacyKeyMigration = {
  oldKey: string
  newKey: string
  transform?: (raw: string) => string
}

// The rename moved the card-style flag inside the zustand envelope as well as its key.
function renameCardStyleField(raw: string): string {
  try {
    const envelope: unknown = JSON.parse(raw)
    if (typeof envelope !== 'object' || envelope === null || !('state' in envelope)) {
      return raw
    }
    const state = envelope.state
    if (typeof state !== 'object' || state === null || !('cachaloteCards' in state)) {
      return raw
    }
    const renamed: Record<string, unknown> = {}
    for (const [field, value] of Object.entries(state)) {
      renamed[field === 'cachaloteCards' ? 'narwhalCards' : field] = value
    }
    return JSON.stringify({ ...envelope, state: renamed })
  } catch {
    return raw
  }
}

const LEGACY_KEY_MIGRATIONS: readonly LegacyKeyMigration[] = [
  {
    oldKey: 'cachalote:card-style',
    newKey: 'narwhal:card-style',
    transform: renameCardStyleField
  },
  { oldKey: 'cachalote:worktree-groups', newKey: 'narwhal:worktree-groups' },
  { oldKey: 'cachalote:branch-format-choices', newKey: 'narwhal:branch-format-choices' },
  { oldKey: 'cachalote:branch-format-projects', newKey: 'narwhal:branch-format-projects' }
]

/** Copies each legacy key to its Narwhal name unless the new key already holds data; never throws.
 * The legacy key stays so a --rollback to a pre-Narwhal build still finds its data. */
export function migrateLegacyStorage(storage: LegacyStorage): void {
  for (const { oldKey, newKey, transform } of LEGACY_KEY_MIGRATIONS) {
    try {
      const legacyValue = storage.getItem(oldKey)
      if (legacyValue === null || storage.getItem(newKey) !== null) {
        continue
      }
      storage.setItem(newKey, transform ? transform(legacyValue) : legacyValue)
    } catch {
      // Storage can throw (quota, disabled); a failed migration must never break app start.
    }
  }
}

try {
  migrateLegacyStorage(localStorage)
} catch {
  // Accessing localStorage itself can throw.
}
