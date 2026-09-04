// src/components/shared/EmptyState.tsx
// Takes a Lucide icon component rather than an emoji string — consistent,
// theme-adaptive, and scalable across all call sites.
import type { ComponentType } from 'react'
import { cn } from '../../lib/utils'

export function EmptyState({ icon: Icon, title, description, action, className, boxed }: {
  icon: ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  /** Wraps the state in its own bordered, shadowed card — for a standalone
   *  section or full page (e.g. "trip not found"). Leave off when the
   *  caller already provides its own framing (a photo-hero card, a tab
   *  panel), so the box doesn't double up. */
  boxed?: boolean
}) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 px-6 text-center',
      boxed && 'rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-md',
      className,
    )}>
      <div className="eis-badge w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-9 h-9 text-primary" />
      </div>
      <h3 className="text-lg font-bold text-on-surface mb-1">{title}</h3>
      {description && <p className="text-sm text-on-surface-variant mb-6 max-w-xs">{description}</p>}
      {action}
    </div>
  )
}
