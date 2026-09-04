// src/components/shared/RescueReadinessChecklist.tsx
// tsi.service.js#computeRescueReadiness already computes this exact 6-item
// breakdown server-side (and persists a snapshot on the trip at
// create/update time), but only ever exposed the rolled-up percentage —
// the itemized reasons were computed and thrown away. Rather than add a
// new endpoint to fetch a stale stored snapshot, this recomputes the same
// six checks from data the Dashboard already has in memory (tourist, DMS,
// active trip), the same "never trust a stale stored score, derive it
// fresh" principle tourist.service.js's computeProfileReadiness already
// uses for the profile-only version of this number.
import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Tourist, Trip, DMS } from '../../types/api.types'

interface ReadinessItem {
  key: string
  label: string
  done: boolean
}

// The app's own offline capability (cached app shell + tiles via the
// service worker — see vite.config.ts's Workbox setup) is the one item
// here that isn't a property of the tourist/trip/DMS records, so it's
// read directly from the browser instead of passed in as a prop.
function useServiceWorkerReady(): boolean {
  const [ready, setReady] = useState(!!navigator.serviceWorker?.controller)
  useEffect(() => {
    if (!navigator.serviceWorker) return
    const onControllerChange = () => setReady(true)
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [])
  return ready
}

export function computeReadinessItems(tourist: Tourist, activeTrip: Trip | undefined, dms: DMS | null | undefined, offlineReady: boolean): ReadinessItem[] {
  return [
    { key: 'emergencyContacts', label: 'Emergency contact added', done: tourist.emergency_contacts.length > 0 },
    { key: 'medicalInfo', label: 'Medical info on file', done: !!tourist.blood_group },
    { key: 'govtIdComplete', label: 'Government ID verified', done: !!tourist.govt_id_suffix },
    { key: 'dmsEnabled', label: "Dead Man's Switch active", done: dms?.status === 'ACTIVE' },
    { key: 'tsiReviewed', label: 'Trip safety score reviewed', done: !!activeTrip?.tsi_score },
    { key: 'offlineReady', label: 'Offline app ready', done: offlineReady },
  ]
}

export function RescueReadinessChecklist({ tourist, activeTrip, dms }: {
  tourist: Tourist
  activeTrip: Trip | undefined
  dms: DMS | null | undefined
}) {
  const offlineReady = useServiceWorkerReady()
  const items = computeReadinessItems(tourist, activeTrip, dms, offlineReady)
  const score = Math.round((items.filter(i => i.done).length / items.length) * 100)

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-md border border-outline-variant p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-on-surface">Rescue Readiness</h3>
        <span className={cn('text-sm font-bold px-2 py-0.5 rounded-full',
          score >= 80 ? 'bg-tsi-low/15 text-tsi-low' : score >= 50 ? 'bg-primary/15 text-primary-dark' : 'bg-sos-light text-sos-dark'
        )}>
          {score}%
        </span>
      </div>
      <p className="text-xs text-on-surface-variant mb-3">How prepared you are if something goes wrong — separate from the trip's own risk score</p>

      <div className="w-full bg-surface-container-high rounded-full h-2 mb-4">
        <div className={cn('h-2 rounded-full transition-all duration-700',
          score >= 80 ? 'bg-tsi-low' : score >= 50 ? 'bg-primary' : 'bg-sos'
        )} style={{ width: `${score}%` }} />
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-2.5">
            <div className={cn('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
              item.done ? 'bg-tsi-low/15 text-tsi-low' : 'bg-surface-container-high text-on-surface-variant')}>
              {item.done ? <Check className="w-3 h-3" strokeWidth={3} /> : <X className="w-3 h-3" strokeWidth={3} />}
            </div>
            <span className={cn('text-sm', item.done ? 'text-on-surface' : 'text-on-surface-variant')}>{item.label}</span>
          </div>
        ))}
      </div>

      {score < 100 && (
        <p className="text-xs text-on-surface-variant mt-3 pt-3 border-t border-outline-variant">
          Complete your profile to improve rescue readiness
        </p>
      )}
    </div>
  )
}
