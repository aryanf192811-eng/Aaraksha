// src/components/shared/TSIBadge.tsx
// TSI score ring: circular progress, amber-to-red gradient by risk band.
import { cn, getTSIColors } from '../../lib/utils'

interface TSIBadgeProps {
  score: number | null
  label?: string | null
  size?: 'sm' | 'md' | 'lg'
  showRing?: boolean
  className?: string
}

const SIZES = {
  sm: { ring: 'w-12 h-12', text: 'text-sm', label: 'text-xs' },
  md: { ring: 'w-20 h-20', text: 'text-xl', label: 'text-xs' },
  lg: { ring: 'w-28 h-28', text: 'text-3xl', label: 'text-sm' },
}

export function TSIBadge({ score, label, size = 'md', showRing = true, className }: TSIBadgeProps) {
  const colors = getTSIColors(score)
  const s = SIZES[size]
  const circumference = 2 * Math.PI * 38 // radius=38, viewBox=100
  const strokeDash = score !== null ? (score / 100) * circumference : 0
  // Matches the tsi.low/moderate/high/extreme hexes in tailwind.config.js —
  // an SVG stroke can't reference a Tailwind class, so these are kept in
  // sync by hand with the token values used everywhere else.
  const strokeColor = score === null ? '#94a3b8'
    : score >= 80 ? '#15803d'
    : score >= 60 ? '#a16207'
    : score >= 40 ? '#c2410c'
    : '#b91c1c'

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {showRing ? (
        <div className={cn('relative', s.ring)}>
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="38" fill="none" stroke="#e2e8f0" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="38" fill="none"
              stroke={strokeColor} strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${circumference}`}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('font-display font-black text-on-surface', s.text)}>
              {score ?? '—'}
            </span>
          </div>
        </div>
      ) : (
        <div className={cn('px-3 py-1 rounded-full border font-semibold', s.text, colors.bg, colors.text, colors.border)}>
          {score ?? '—'}/100
        </div>
      )}
      {(label || colors.label) && (
        <span className={cn('font-semibold', s.label, colors.text)}>
          {label || colors.label}
        </span>
      )}
    </div>
  )
}
