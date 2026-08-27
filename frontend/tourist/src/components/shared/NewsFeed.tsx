// src/components/shared/NewsFeed.tsx
// Renders a list of destination news/alert items — shared between the
// Dashboard's compact "Latest Alerts" card and the Trip Detail News tab.
import { CloudRain, Construction, PartyPopper, Megaphone, Calendar, Info, AlertTriangle, AlertOctagon } from 'lucide-react'
import type { DestinationNews } from '../../api/news.api'
import { formatTimeAgo, cn } from '../../lib/utils'

const CATEGORY_ICON: Record<DestinationNews['category'], typeof CloudRain> = {
  WEATHER: CloudRain, ROAD_CLOSURE: Construction, EVENT: Calendar,
  ADVISORY: Megaphone, FESTIVAL: PartyPopper, OTHER: Info,
}

const SEVERITY_STYLE: Record<DestinationNews['severity'], { badge: string; icon: typeof Info; label: string }> = {
  INFO:     { badge: 'bg-surface-container text-on-surface-variant', icon: Info, label: 'Info' },
  WARNING:  { badge: 'bg-primary/15 text-primary-dark', icon: AlertTriangle, label: 'Warning' },
  CRITICAL: { badge: 'bg-sos/15 text-sos-dark', icon: AlertOctagon, label: 'Critical' },
}

interface NewsFeedProps {
  items: DestinationNews[]
  showDestinationName?: boolean
  emptyMessage?: string
}

export function NewsFeed({ items, showDestinationName, emptyMessage = 'No news or alerts right now' }: NewsFeedProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 py-4">
        <div className="w-10 h-10 rounded-full bg-trust/10 flex items-center justify-center flex-shrink-0">
          <Info className="w-5 h-5 text-trust" />
        </div>
        <p className="text-sm text-on-surface-variant">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const CategoryIcon = CATEGORY_ICON[item.category] || Info
        const severity = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE.INFO
        const SeverityIcon = severity.icon
        return (
          <div key={item.id} className={cn(
            'rounded-2xl p-4 border',
            item.severity === 'CRITICAL' ? 'bg-sos/5 border-sos/25' : 'bg-surface-container-lowest border-outline-variant'
          )}>
            <div className="flex items-start gap-3">
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', severity.badge)}>
                <CategoryIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1', severity.badge)}>
                    <SeverityIcon className="w-3 h-3" /> {severity.label}
                  </span>
                  {showDestinationName && item.destination_name && (
                    <span className="text-[10px] font-semibold text-on-surface-variant">{item.destination_name}</span>
                  )}
                  <span className="text-[10px] text-on-surface-variant ml-auto">{formatTimeAgo(item.published_at)}</span>
                </div>
                <p className="font-bold text-on-surface text-sm">{item.headline}</p>
                {item.body && <p className="text-xs text-on-surface-variant mt-1">{item.body}</p>}
                <p className="text-[10px] text-on-surface-variant mt-1.5">Source: {item.source}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
