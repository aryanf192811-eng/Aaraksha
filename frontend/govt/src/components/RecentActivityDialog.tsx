// src/components/RecentActivityDialog.tsx
// Shared "View all" dialog behind a dashboard panel's compact top-3 stack —
// NTNPanel and Dashboard's Recent Incidents both use it. Row rendering is
// left to the caller (`renderRow`) since NTN messages and SOS events don't
// share a shape; the day-range filter and loading/empty states are the
// part actually worth sharing.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { cn } from '../lib/utils'

const DAY_OPTIONS = [
  { label: '24h', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

export function RecentActivityDialog<T extends { id: string }>({
  open, onOpenChange, title, description, queryKey, queryFn, renderRow, emptyLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  queryKey: string
  queryFn: (days: number) => Promise<T[]>
  renderRow: (item: T) => React.ReactNode
  emptyLabel: string
}) {
  const [days, setDays] = useState(7)

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, 'view-all', days],
    queryFn: () => queryFn(days),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5 flex-wrap">
          {DAY_OPTIONS.map((opt) => (
            <button key={opt.days} onClick={() => setDays(opt.days)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                days === opt.days ? 'bg-primary-dark text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high')}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          {!isLoading && (!data || data.length === 0) && (
            <p className="text-sm text-on-surface-variant text-center py-12">{emptyLabel}</p>
          )}
          {!isLoading && data && data.length > 0 && (
            <div className="space-y-1">
              {data.map((item) => (
                <div key={item.id}>{renderRow(item)}</div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
