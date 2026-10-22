import {
  Bug,
  FileText,
  FlaskConical,
  Globe,
  Layers,
  Palette,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wrench,
  Zap,
  type LucideIcon
} from 'lucide-react'
import { createElement } from 'react'
import * as rendererI18n from '@/i18n/i18n'

// A short set of icons Orca already ships, enough to tell features apart at a glance.
const ICONS = [
  { id: 'layers', Icon: Layers, es: 'General', en: 'General' },
  { id: 'sparkles', Icon: Sparkles, es: 'Feature', en: 'Feature' },
  { id: 'bug', Icon: Bug, es: 'Fix', en: 'Fix' },
  { id: 'wrench', Icon: Wrench, es: 'Mantenimiento', en: 'Maintenance' },
  { id: 'flask', Icon: FlaskConical, es: 'Experimento', en: 'Experiment' },
  { id: 'shield', Icon: ShieldCheck, es: 'Seguridad', en: 'Security' },
  { id: 'server', Icon: Server, es: 'Backend', en: 'Backend' },
  { id: 'palette', Icon: Palette, es: 'UI', en: 'UI' },
  { id: 'globe', Icon: Globe, es: 'Web', en: 'Web' },
  { id: 'smartphone', Icon: Smartphone, es: 'Móvil', en: 'Mobile' },
  { id: 'file', Icon: FileText, es: 'Docs', en: 'Docs' },
  { id: 'zap', Icon: Zap, es: 'Rendimiento', en: 'Performance' }
] as const

export const DEFAULT_WORKTREE_GROUP_ICON = 'layers'

export type WorktreeGroupIconOption = { id: string; Icon: LucideIcon; label: string }

function isSpanish(): boolean {
  // Sidebar tests mock this module with `translate` only; reading the instance there throws.
  try {
    return (rendererI18n.i18n.language ?? 'en').startsWith('es')
  } catch {
    return false
  }
}

export function worktreeGroupIconOptions(): WorktreeGroupIconOption[] {
  const es = isSpanish()
  return ICONS.map(({ id, Icon, ...label }) => ({ id, Icon, label: es ? label.es : label.en }))
}

/** The icon for a stored id; unknown or missing ids (older groups) fall back to the default. */
export function worktreeGroupIcon(id: string | undefined): LucideIcon {
  return ICONS.find((icon) => icon.id === id)?.Icon ?? Layers
}

/** Renders a group's icon from its stored id; a fixed component so the icon never remounts. */
export function WorktreeGroupIcon({
  icon,
  className
}: {
  icon: string | undefined
  className?: string
}): React.JSX.Element {
  return createElement(worktreeGroupIcon(icon), { className })
}
