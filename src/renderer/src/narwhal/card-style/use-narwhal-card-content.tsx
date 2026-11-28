import React from 'react'

import type { WorktreeCardController } from '@/components/sidebar/workspace-card/controller/use-worktree-card-controller'
import { useNarwhalCardStyleStore } from './card-style-store'
import { NarwhalCardContent } from './NarwhalCardContent'

/**
 * Narwhal's content for a card, or null to keep upstream's: inline rename, one-line rows,
 * folder workspaces and affiliate lists still draw the upstream template.
 */
export function useNarwhalCardContent(card: WorktreeCardController): React.ReactNode | null {
  const enabled = useNarwhalCardStyleStore((s) => s.narwhalCards)
  if (
    !enabled ||
    !card.newCardStyle ||
    card.titleRenaming ||
    card.compactLine ||
    card.affiliateListMode ||
    card.isFolder
  ) {
    return null
  }
  return <NarwhalCardContent card={card} />
}
