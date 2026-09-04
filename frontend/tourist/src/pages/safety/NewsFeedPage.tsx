// src/pages/safety/NewsFeedPage.tsx
// Cross-destination news & alerts feed. The tourist's own active trip's
// news is pinned boldly at the very top in its own labeled section, then
// a filterable (state, severity), paginated feed spans every destination
// below it. Reached from Dashboard's "Latest Alerts" View all — this page
// is the general alerts hub, not scoped to a single trip's News tab.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Newspaper, MapPin, Compass } from 'lucide-react'
import { NewsFeed, EmptyState } from '../../components/shared'
import tripApi from '../../api/trip.api'
import newsApi from '../../api/news.api'
import type { DestinationNews } from '../../api/news.api'
import destinationApi from '../../api/destination.api'
import { tEnum } from '../../lib/i18nEnums'
import { cn } from '../../lib/utils'
import { TRIP_STATUSES } from '../../constants/enums'

const SEVERITIES: DestinationNews['severity'][] = ['INFO', 'WARNING', 'CRITICAL']
const PAGE_SIZE = 10

export default function NewsFeedPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [selectedState, setSelectedState] = useState('')
  const [selectedSeverity, setSelectedSeverity] = useState<DestinationNews['severity'] | ''>('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<DestinationNews[]>([])

  // Active trip — same lookup DashboardPage.tsx already uses.
  const { data: tripsData } = useQuery({
    queryKey: ['trips'],
    queryFn: () => tripApi.getMyTrips({ limit: 10 }).then(r => r.data),
    staleTime: 60_000,
  })
  const activeTrip = (tripsData?.data || []).find(trip => trip.status === TRIP_STATUSES.ACTIVE)

  const { data: tripNews } = useQuery({
    queryKey: ['trips', activeTrip?.id, 'news'],
    queryFn: () => newsApi.getForTrip(activeTrip!.id).then(r => r.data.data),
    enabled: !!activeTrip,
    staleTime: 2 * 60_000,
  })

  // Real states from the seeded destinations — never a hardcoded list.
  const { data: destinations } = useQuery({
    queryKey: ['destinations'],
    queryFn: () => destinationApi.getAll().then(r => r.data.data),
    staleTime: 5 * 60_000,
  })
  const states = [...new Set((destinations || []).map(d => d.state))].sort()

  // A filter change starts the feed over at page 1.
  useEffect(() => { setPage(1) }, [selectedState, selectedSeverity])

  const { data: newsPage, isLoading, isFetching } = useQuery({
    queryKey: ['news', 'all', selectedState, selectedSeverity, page],
    queryFn: () => newsApi.getAll({
      state: selectedState || undefined,
      severity: selectedSeverity || undefined,
      page,
      limit: PAGE_SIZE,
    }).then(r => r.data),
    staleTime: 60_000,
  })

  // Accumulate "Load more" pages into one list — page 1 always replaces
  // (covers a filter change landing back on page 1), later pages append.
  // The ref guards StrictMode's double-invoke from appending the same
  // page's results twice.
  const appendedPageRef = useRef(0)
  useEffect(() => {
    if (!newsPage) return
    if (page === 1) {
      setItems(newsPage.data)
    } else if (appendedPageRef.current !== page) {
      setItems(prev => [...prev, ...newsPage.data])
    }
    appendedPageRef.current = page
  }, [newsPage, page])

  const hasMore = newsPage?.pagination.hasNext ?? false

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label={t('common.back')}>
            <ArrowLeft className="w-6 h-6 text-on-surface" />
          </button>
          <div>
            <h1 className="text-xl font-black text-on-surface flex items-center gap-2">
              <Newspaper className="w-5 h-5" /> {t('newsFeed.title')}
            </h1>
            <p className="text-xs text-on-surface-variant">{t('newsFeed.subtitle')}</p>
          </div>
        </div>
      </div>

      {activeTrip && tripNews && tripNews.length > 0 && (
        <div className="px-5 mt-5">
          <p className="text-[11px] font-extrabold text-primary-dark uppercase tracking-widest mb-2">
            {t('newsFeed.yourTripEyebrow')}
          </p>
          <div className="rounded-3xl border border-primary/25 bg-primary/5 shadow-glass p-4">
            <p className="font-display font-black text-on-surface text-base mb-3 truncate">{activeTrip.title}</p>
            <NewsFeed items={tripNews} />
          </div>
        </div>
      )}

      <div className="px-5 mt-6">
        <h2 className="font-display text-lg font-extrabold text-on-surface mb-3">{t('newsFeed.allUpdatesTitle')}</h2>

        {/* State filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <button onClick={() => setSelectedState('')}
            className={cn('min-h-[44px] px-4 rounded-full text-xs font-semibold whitespace-nowrap border transition-all',
              !selectedState ? 'bg-on-surface text-surface border-on-surface' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant')}>
            {t('newsFeed.allStates')}
          </button>
          {states.map(state => (
            <button key={state} onClick={() => setSelectedState(state === selectedState ? '' : state)}
              className={cn('min-h-[44px] px-4 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-1',
                selectedState === state ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant')}>
              <MapPin className="w-3.5 h-3.5" /> {state}
            </button>
          ))}
        </div>

        {/* Severity filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mt-1 -mx-1 px-1">
          <button onClick={() => setSelectedSeverity('')}
            className={cn('min-h-[44px] px-4 rounded-full text-xs font-semibold whitespace-nowrap border transition-all',
              !selectedSeverity ? 'bg-on-surface text-surface border-on-surface' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant')}>
            {t('newsFeed.allSeverities')}
          </button>
          {SEVERITIES.map(sev => (
            <button key={sev} onClick={() => setSelectedSeverity(sev === selectedSeverity ? '' : sev)}
              className={cn('min-h-[44px] px-4 rounded-full text-xs font-semibold whitespace-nowrap border transition-all',
                selectedSeverity === sev ? 'bg-primary text-primary-foreground border-primary' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant')}>
              {tEnum(t, 'newsSeverity', sev)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-surface-container-lowest rounded-2xl animate-pulse" />)}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <EmptyState icon={Compass} title={t('newsFeed.emptyTitle')} description={t('newsFeed.emptyDescription')} boxed />
        )}

        {!isLoading && items.length > 0 && (
          <>
            <NewsFeed items={items} showDestinationName />
            {hasMore && (
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={isFetching}
                className="w-full mt-4 h-12 rounded-full border border-outline-variant bg-surface-container-lowest text-sm font-bold text-on-surface disabled:opacity-60"
              >
                {isFetching ? t('common.loading') : t('newsFeed.loadMore')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
