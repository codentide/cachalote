import { Radar } from 'lucide-react'
import type { ActivityBarItem } from '../../components/right-sidebar/activity-bar-buttons'
import { liveLabel } from './live-labels'
import { liveApi } from './live-store'

/**
 * The Sonar tab. No visibility flags: it lists every project, so it never depends on the active
 * workspace. Static (no hooks) so it adds no deps to the activity items' memo.
 */
export function sonarActivityItems(): ActivityBarItem[] {
  // Sonar runs only in the macOS desktop app; the web client has no cachaloteLive bridge.
  if (!navigator.userAgent.includes('Mac') || !liveApi()) {
    return []
  }
  return [{ id: 'sonar', icon: Radar, title: liveLabel('name'), shortcut: '' }]
}
