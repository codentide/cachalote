import {
  Activity,
  Apple,
  Bell,
  Bike,
  Bot,
  Bug,
  Building2,
  Calendar,
  ChartColumn,
  Cloud,
  CreditCard,
  Database,
  Dumbbell,
  FileText,
  FlaskConical,
  Footprints,
  Gift,
  Globe,
  HeartPulse,
  Image,
  KeyRound,
  Layers,
  Lock,
  Mail,
  MapPin,
  Medal,
  MessageSquare,
  Palette,
  Percent,
  Plug,
  QrCode,
  Receipt,
  Search,
  Server,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Stethoscope,
  Ticket,
  Timer,
  Trophy,
  Users,
  Waves,
  Wrench,
  Zap,
  type LucideIcon
} from 'lucide-react'
import { createElement } from 'react'
import * as rendererI18n from '@/i18n/i18n'

type Category = 'work' | 'business' | 'fitness' | 'platform'

// Lucide icons (Orca's icon library), sorted by what a feature is about. Ids are stored on groups,
// so an id never changes once shipped.
const ICONS: readonly {
  id: string
  Icon: LucideIcon
  category: Category
  es: string
  en: string
}[] = [
  { id: 'layers', Icon: Layers, category: 'work', es: 'General', en: 'General' },
  { id: 'sparkles', Icon: Sparkles, category: 'work', es: 'Feature', en: 'Feature' },
  { id: 'bug', Icon: Bug, category: 'work', es: 'Fix', en: 'Fix' },
  { id: 'wrench', Icon: Wrench, category: 'work', es: 'Mantenimiento', en: 'Maintenance' },
  { id: 'flask', Icon: FlaskConical, category: 'work', es: 'Experimento', en: 'Experiment' },
  { id: 'shield', Icon: ShieldCheck, category: 'work', es: 'Seguridad', en: 'Security' },
  { id: 'server', Icon: Server, category: 'work', es: 'Backend', en: 'Backend' },
  { id: 'palette', Icon: Palette, category: 'work', es: 'UI', en: 'UI' },
  { id: 'globe', Icon: Globe, category: 'work', es: 'Web', en: 'Web' },
  { id: 'smartphone', Icon: Smartphone, category: 'work', es: 'Móvil', en: 'Mobile' },
  { id: 'file', Icon: FileText, category: 'work', es: 'Docs', en: 'Docs' },
  { id: 'zap', Icon: Zap, category: 'work', es: 'Rendimiento', en: 'Performance' },

  { id: 'credit-card', Icon: CreditCard, category: 'business', es: 'Pagos', en: 'Payments' },
  { id: 'receipt', Icon: Receipt, category: 'business', es: 'Facturación', en: 'Billing' },
  { id: 'cart', Icon: ShoppingCart, category: 'business', es: 'Checkout', en: 'Checkout' },
  { id: 'percent', Icon: Percent, category: 'business', es: 'Descuentos', en: 'Discounts' },
  { id: 'gift', Icon: Gift, category: 'business', es: 'Beneficios', en: 'Benefits' },
  { id: 'ticket', Icon: Ticket, category: 'business', es: 'Reservas', en: 'Bookings' },
  { id: 'calendar', Icon: Calendar, category: 'business', es: 'Agenda', en: 'Schedule' },
  { id: 'users', Icon: Users, category: 'business', es: 'Clientes', en: 'Customers' },
  { id: 'building', Icon: Building2, category: 'business', es: 'Sedes', en: 'Locations' },
  { id: 'map-pin', Icon: MapPin, category: 'business', es: 'Ubicación', en: 'Place' },
  { id: 'chart', Icon: ChartColumn, category: 'business', es: 'Reportes', en: 'Reports' },
  { id: 'mail', Icon: Mail, category: 'business', es: 'Correos', en: 'Email' },

  { id: 'dumbbell', Icon: Dumbbell, category: 'fitness', es: 'Gimnasio', en: 'Gym' },
  { id: 'heart-pulse', Icon: HeartPulse, category: 'fitness', es: 'Bienestar', en: 'Wellness' },
  { id: 'activity', Icon: Activity, category: 'fitness', es: 'Actividad', en: 'Activity' },
  { id: 'trophy', Icon: Trophy, category: 'fitness', es: 'Deportes', en: 'Sports' },
  { id: 'medal', Icon: Medal, category: 'fitness', es: 'Logros', en: 'Achievements' },
  { id: 'bike', Icon: Bike, category: 'fitness', es: 'Ciclismo', en: 'Cycling' },
  { id: 'waves', Icon: Waves, category: 'fitness', es: 'Piscina', en: 'Pool' },
  { id: 'footprints', Icon: Footprints, category: 'fitness', es: 'Running', en: 'Running' },
  { id: 'timer', Icon: Timer, category: 'fitness', es: 'Clases', en: 'Classes' },
  { id: 'apple', Icon: Apple, category: 'fitness', es: 'Nutrición', en: 'Nutrition' },
  { id: 'stethoscope', Icon: Stethoscope, category: 'fitness', es: 'Área médica', en: 'Medical' },

  { id: 'lock', Icon: Lock, category: 'platform', es: 'Autenticación', en: 'Auth' },
  { id: 'key', Icon: KeyRound, category: 'platform', es: 'Permisos', en: 'Permissions' },
  { id: 'bell', Icon: Bell, category: 'platform', es: 'Notificaciones', en: 'Notifications' },
  { id: 'message', Icon: MessageSquare, category: 'platform', es: 'Chat', en: 'Chat' },
  { id: 'database', Icon: Database, category: 'platform', es: 'Datos', en: 'Data' },
  { id: 'cloud', Icon: Cloud, category: 'platform', es: 'Infra', en: 'Infra' },
  { id: 'plug', Icon: Plug, category: 'platform', es: 'Integraciones', en: 'Integrations' },
  { id: 'bot', Icon: Bot, category: 'platform', es: 'IA', en: 'AI' },
  { id: 'image', Icon: Image, category: 'platform', es: 'Media', en: 'Media' },
  { id: 'search', Icon: Search, category: 'platform', es: 'Búsqueda', en: 'Search' },
  { id: 'qr', Icon: QrCode, category: 'platform', es: 'QR / acceso', en: 'QR / access' },
  { id: 'settings', Icon: Settings, category: 'platform', es: 'Configuración', en: 'Settings' }
]

const CATEGORIES: readonly { id: Category; es: string; en: string }[] = [
  { id: 'work', es: 'Tipo de trabajo', en: 'Kind of work' },
  { id: 'business', es: 'Negocio', en: 'Business' },
  { id: 'fitness', es: 'Gimnasio y bienestar', en: 'Fitness and wellness' },
  { id: 'platform', es: 'Plataforma', en: 'Platform' }
]

export const DEFAULT_WORKTREE_GROUP_ICON = 'layers'

export type WorktreeGroupIconOption = { id: string; Icon: LucideIcon; label: string }
export type WorktreeGroupIconCategory = {
  id: string
  label: string
  icons: WorktreeGroupIconOption[]
}

function isSpanish(): boolean {
  // Sidebar tests mock this module with `translate` only; reading the instance there throws.
  try {
    return (rendererI18n.i18n.language ?? 'en').startsWith('es')
  } catch {
    return false
  }
}

export function worktreeGroupIconCategories(): WorktreeGroupIconCategory[] {
  const es = isSpanish()
  return CATEGORIES.map((category) => ({
    id: category.id,
    label: es ? category.es : category.en,
    icons: ICONS.filter((icon) => icon.category === category.id).map((icon) => ({
      id: icon.id,
      Icon: icon.Icon,
      label: es ? icon.es : icon.en
    }))
  }))
}

/** Every option, flat. */
export function worktreeGroupIconOptions(): WorktreeGroupIconOption[] {
  return worktreeGroupIconCategories().flatMap((category) => category.icons)
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
