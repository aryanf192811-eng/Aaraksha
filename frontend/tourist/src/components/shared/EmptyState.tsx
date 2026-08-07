// src/components/shared/EmptyState.tsx
// Takes a Lucide icon component rather than an emoji string — consistent,
// theme-adaptive, and scalable across all call sites.
import type { ComponentType } from 'react'
import { cn } from '../../lib/utils'

export function EmptyState({ icon: Icon, title, description, action, className }: {
  icon: ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      <Icon className="w-12 h-12 text-slate-300 mb-4" />
      <h3 className="text-lg font-bold text-on-surface mb-1">{title}</h3>
      {description && <p className="text-sm text-on-surface-variant mb-6 max-w-xs">{description}</p>}
      {action}
    </div>
  )
}
