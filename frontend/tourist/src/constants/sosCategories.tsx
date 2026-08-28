// src/constants/sosCategories.tsx
// Single source of truth for the SOS emergency-category list — shared by
// the Safety Center's full category grid (SOSPage.tsx) and the Dashboard's
// inline quick-picker (DashboardPage.tsx), so the two surfaces can never
// drift out of sync on labels, icons, or colors.
import {
  HeartPulse, Compass, Mountain, Waves, ShieldAlert, HelpCircle,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { SOSCategory } from './enums'

export const SOS_CATEGORY_CONFIG: { value: SOSCategory; Icon: ComponentType<{ className?: string }>; color: string }[] = [
  { value: 'MEDICAL',  Icon: HeartPulse,  color: 'bg-sos-light text-sos-dark' },
  { value: 'LOST',     Icon: Compass,     color: 'bg-primary/15 text-primary-dark' },
  { value: 'TRAPPED',  Icon: Mountain,    color: 'bg-tsi-high/10 text-tsi-high' },
  { value: 'DISASTER', Icon: Waves,       color: 'bg-blue-100 text-blue-700' },
  { value: 'CRIME',    Icon: ShieldAlert, color: 'bg-purple-100 text-purple-700' },
  { value: 'OTHER',    Icon: HelpCircle,  color: 'bg-surface-container-high text-on-surface-variant' },
]

// The default category a quick-send (no explicit choice made) files under —
// matches SOSPage's own pre-selection default.
export const DEFAULT_SOS_CATEGORY: SOSCategory = 'OTHER'
