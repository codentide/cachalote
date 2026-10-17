import { useEffect, useMemo, useState } from 'react'
import { Radar } from 'lucide-react'
import { useAppStore } from '@/store'
import { liveLabel } from './live-labels'
import { liveApi, useLiveStore, useLiveStoreStarted } from './live-store'
import { buildSonarPanelSections } from './sonar-panel-model'
import { SonarProjectSection } from './SonarProjectSection'

const CLOCK_MS = 30_000

function SonarEmptyState({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center text-muted-foreground">
      <Radar size={32} className="mb-3 opacity-50" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

export default function SonarPanel({
  isVisible
}: {
  isVisible: boolean
}): React.JSX.Element | null {
  useLiveStoreStarted()
  const supported = useLiveStore((s) => s.supported)
  const slotsByRepo = useLiveStore((s) => s.byRepo)
  const standbyByRepo = useLiveStore((s) => s.standbyByRepo)
  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isVisible) {
      return
    }
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS)
    return () => clearInterval(timer)
  }, [isVisible])

  const sections = useMemo(
    () =>
      buildSonarPanelSections({
        repos,
        worktreesByRepo,
        slotsByRepo,
        standbyByRepo,
        activeWorktreeId
      }),
    [repos, worktreesByRepo, slotsByRepo, standbyByRepo, activeWorktreeId]
  )

  if (!liveApi()) {
    return <SonarEmptyState text={liveLabel('panelUnsupported')} />
  }
  // The store reports false until its first snapshot; render nothing to avoid a flash.
  if (!supported) {
    return null
  }
  if (sections.length === 0) {
    return <SonarEmptyState text={liveLabel('panelEmpty')} />
  }
  return (
    <div className="h-full min-h-0 overflow-y-auto pb-2 scrollbar-sleek">
      {sections.map((section) => (
        <SonarProjectSection
          key={section.repoId}
          section={section}
          now={now}
          isVisible={isVisible}
        />
      ))}
    </div>
  )
}
