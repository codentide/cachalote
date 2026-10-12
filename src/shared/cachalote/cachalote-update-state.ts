/** What Cachalote's update card shows; pushed from main on the `cachalote:update-state` channel. */
export type CachaloteUpdateState =
  | { kind: 'checking' }
  | { kind: 'current'; version: string | null }
  | { kind: 'unreachable' }
  | { kind: 'running' }
  | {
      kind: 'available'
      /** New upstream release tag, if any. */
      release: string | null
      /** Own commits missing from the installed build, as readable titles. */
      changes: readonly string[]
      /** Upstream could not be checked; only own commits are known. */
      upstreamUnreachable: boolean
    }
  | { kind: 'started' }
  | { kind: 'failed'; message: string }

export const CACHALOTE_UPDATE_STATE_CHANNEL = 'cachalote:update-state'
export const CACHALOTE_UPDATE_START_CHANNEL = 'cachalote:update-start'

/** `3d93ed5 feat(cachalote): color for worktree groups` → `Color for worktree groups`. */
export function toChangeTitle(onelineCommit: string): string {
  const subject = onelineCommit.replace(/^[0-9a-f]{7,40}\s+/, '')
  const title = subject.replace(/^[a-z]+(\([^)]*\))?!?:\s*/, '')
  return title.charAt(0).toUpperCase() + title.slice(1)
}
