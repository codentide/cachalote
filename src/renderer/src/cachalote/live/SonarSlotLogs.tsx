import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { liveLabel } from './live-labels'
import { liveActions } from './live-store'

const POLL_MS = 1500
const BOTTOM_TOLERANCE_PX = 8

/** Server output of one slot, refreshed while `active`. */
export function SonarSlotLogs({
  repoId,
  slotId,
  active
}: {
  repoId: string
  slotId: string
  active: boolean
}): React.JSX.Element {
  const [lines, setLines] = useState<readonly string[]>([])
  const [truncated, setTruncated] = useState(false)
  const preRef = useRef<HTMLPreElement | null>(null)
  const stickToBottom = useRef(true)

  useEffect(() => {
    if (!active) {
      return
    }
    let cancelled = false
    const load = async (): Promise<void> => {
      const result = await liveActions.logs({ repoId, slotId, limit: 200 })
      if (cancelled || !result) {
        return
      }
      const pre = preRef.current
      // Measured before the new lines render, so a user who scrolled up keeps their place.
      stickToBottom.current =
        !pre || pre.scrollHeight - pre.scrollTop - pre.clientHeight <= BOTTOM_TOLERANCE_PX
      setLines(result.lines)
      setTruncated(result.truncated)
    }
    void load()
    const timer = setInterval(() => void load(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [repoId, slotId, active])

  useLayoutEffect(() => {
    const pre = preRef.current
    if (pre && stickToBottom.current) {
      pre.scrollTop = pre.scrollHeight
    }
  }, [lines])

  return (
    <div className="min-w-0 space-y-1 px-3 pb-2">
      {lines.length === 0 ? (
        <p className="text-2xs text-muted-foreground">{liveLabel('logsEmpty')}</p>
      ) : (
        <pre
          ref={preRef}
          className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-3 font-mono text-xs text-muted-foreground scrollbar-sleek"
        >
          {lines.join('\n')}
        </pre>
      )}
      {truncated ? (
        <p className="text-2xs text-muted-foreground">
          {liveLabel('logsTruncated', { count: lines.length })}
        </p>
      ) : null}
    </div>
  )
}
