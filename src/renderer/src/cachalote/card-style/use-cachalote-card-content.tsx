import React from 'react'

import type { WorktreeCardController } from '@/components/sidebar/workspace-card/controller/use-worktree-card-controller'
import { useCachaloteCardStyleStore } from './card-style-store'
import { CachaloteCardContent } from './CachaloteCardContent'

/**
 * Cachalote's content for a card, or null to keep upstream's: inline rename, one-line rows,
 * folder workspaces and affiliate lists still draw the upstream template.
 */
export function useCachaloteCardContent(card: WorktreeCardController): React.ReactNode | null {
  const enabled = useCachaloteCardStyleStore((s) => s.cachaloteCards)
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
  return <CachaloteCardContent card={card} />
}
