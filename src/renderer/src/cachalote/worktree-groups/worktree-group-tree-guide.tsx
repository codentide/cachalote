import React, { useLayoutEffect, useRef, useState } from 'react'

import { cn } from '@/lib/class-names'
import { useWorktreeGroupFolderMembers } from './worktree-group-folder-members'
import { useWorktreeGroupGuideAnchors } from './worktree-group-guide-anchor'

// Same tone as an idle card's edge, so the tree reads as part of the cards.
const GUIDE_TONE = 'border-worktree-sidebar-border'
// Each branch curves off the trunk into its card.
const BRANCH_RADIUS = 6

/** The vertical run of a folder's tree guide. */
export const GROUP_TREE_GUIDE_CLASS_NAME = cn(
  'pointer-events-none absolute w-0 border-l',
  GUIDE_TONE
)

type GuideGeometry = { left: number; branchWidth: number }

/**
 * A member card's piece of its folder's tree guide: the line under the header's chevron, and a
 * branch into the card. Rendered inside the card box so it positions against the card's frame.
 */
export function WorktreeGroupTreeGuide({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const position = useWorktreeGroupFolderMembers((s) => s.positions.get(worktreeId))
  const anchorX = useWorktreeGroupGuideAnchors((s) =>
    position ? s.anchors[position.groupId] : undefined
  )
  const ref = useRef<HTMLSpanElement>(null)
  const [geometry, setGeometry] = useState<GuideGeometry | null>(null)

  useLayoutEffect(() => {
    const guide = ref.current
    const frame = guide?.closest('[data-worktree-card-surface]')
    const box = guide?.parentElement
    if (!frame || !box || anchorX === undefined) {
      setGeometry(null)
      return
    }
    const frameLeft = frame.getBoundingClientRect().left
    const left = Math.round(anchorX - frameLeft)
    const branchWidth = Math.round(box.getBoundingClientRect().left - frameLeft - left - 2)
    // A guide that would cross into the card means the anchor is stale; draw nothing.
    setGeometry(branchWidth > 2 ? { left, branchWidth } : null)
  }, [anchorX, position?.groupId])

  if (!position) {
    return null
  }
  return (
    // display: contents keeps it out of the card's flex gap; its lines position on the frame.
    <span ref={ref} aria-hidden="true" className="contents">
      {geometry ? (
        <>
          <span
            className={cn(GROUP_TREE_GUIDE_CLASS_NAME, 'top-0', !position.last && 'bottom-0')}
            style={{
              left: geometry.left,
              ...(position.last ? { bottom: `calc(50% + ${BRANCH_RADIUS}px)` } : {})
            }}
          />
          <span
            className={cn('pointer-events-none absolute border-b border-l', GUIDE_TONE)}
            style={{
              left: geometry.left,
              top: `calc(50% - ${BRANCH_RADIUS}px)`,
              height: BRANCH_RADIUS,
              width: geometry.branchWidth,
              borderBottomLeftRadius: BRANCH_RADIUS
            }}
          />
        </>
      ) : null}
    </span>
  )
}
