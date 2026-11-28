import { useLayoutEffect, type RefObject } from 'react'
import { create } from 'zustand'

type GuideAnchorState = {
  /** Group id → viewport x of its header chevron, where the folder's tree guide runs down. */
  anchors: Readonly<Record<string, number>>
  setAnchor: (groupId: string, x: number) => void
}

export const useWorktreeGroupGuideAnchors = create<GuideAnchorState>()((set) => ({
  anchors: {},
  setAnchor: (groupId, x) =>
    set((state) =>
      state.anchors[groupId] === x ? state : { anchors: { ...state.anchors, [groupId]: x } }
    )
}))

/** Publishes where the header's chevron sits; member cards are separate rows and read it back. */
export function usePublishGuideAnchor(groupId: string, anchorRef: RefObject<Element | null>): void {
  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (rect && rect.width > 0) {
      useWorktreeGroupGuideAnchors.getState().setAnchor(groupId, rect.left + rect.width / 2)
    }
  })
}
