// src/constants/sosCategories.tsx
// Single source of truth for the SOS emergency-category list — shared by
// the Safety Center's full category grid (SOSPage.tsx) and the Dashboard's
// inline quick-picker (DashboardPage.tsx), so the two surfaces can never
// drift out of sync on labels, icons, or colors.
import {
  HeartPulse, Compass, Mountain, Waves, ShieldAlert, HelpCircle, UserSearch,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { SOSCategory } from './enums'

// All 7 backend SOS_CATEGORIES (backend/src/constants/enums.js) must be
// represented here -- MISSING was previously absent, which meant no UI
// anywhere (initial trigger grid or the "add another concern" amendment
// panel) could ever actually select it, even though the backend fully
// supported it end to end.
export const SOS_CATEGORY_CONFIG: { value: SOSCategory; Icon: ComponentType<{ className?: string }>; color: string }[] = [
  { value: 'MEDICAL',  Icon: HeartPulse,  color: 'bg-sos-light text-sos-dark' },
  { value: 'LOST',     Icon: Compass,     color: 'bg-primary/15 text-primary-dark' },
  { value: 'MISSING',  Icon: UserSearch,  color: 'bg-primary/15 text-primary-dark' },
  { value: 'TRAPPED',  Icon: Mountain,    color: 'bg-tsi-high/10 text-tsi-high' },
  { value: 'DISASTER', Icon: Waves,       color: 'bg-blue-100 text-blue-700' },
  { value: 'CRIME',    Icon: ShieldAlert, color: 'bg-purple-100 text-purple-700' },
  { value: 'OTHER',    Icon: HelpCircle,  color: 'bg-surface-container-high text-on-surface-variant' },
]

// The default category a quick-send (no explicit choice made) files under —
// matches SOSPage's own pre-selection default.
export const DEFAULT_SOS_CATEGORY: SOSCategory = 'OTHER'

// User-facing selection grids (the initial trigger grid, the "add another
// concern" amendment panel) show only the specific, actionable categories
// -- OTHER isn't a distinct concern to tap, it's the fallback for "none of
// these," and SOSPage already pre-selects it by default. Dropping its tile
// turns a 7-item grid (3+3+1, an orphan last row) into a clean 2x3 grid
// with no category actually becoming unreachable — a tourist who taps
// nothing still files as OTHER exactly as before.
export const SOS_SPECIFIC_CATEGORIES = SOS_CATEGORY_CONFIG.filter((c) => c.value !== 'OTHER')
