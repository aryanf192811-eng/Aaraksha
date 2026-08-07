// src/components/shared/BatteryIcon.tsx
// Uses lucide-react battery glyphs rather than the emoji the original spec
// used — the ui-ux-pro-max design skill flags emoji-as-structural-icon as
// an anti-pattern (font-dependent, inconsistent across platforms/themes).
import { BatteryFull, BatteryMedium, BatteryWarning } from 'lucide-react'
import { cn } from '../../lib/utils'

export function BatteryIcon({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const Icon = pct > 50 ? BatteryFull : pct > 20 ? BatteryMedium : BatteryWarning
  const color = pct > 50 ? 'text-green-500' : pct > 20 ? 'text-amber-500' : 'text-red-500 animate-pulse'
  return (
    <div className={cn('flex items-center gap-1 text-xs font-medium', color)}>
      <Icon className="w-4 h-4" />
      <span>{pct}%</span>
    </div>
  )
}
