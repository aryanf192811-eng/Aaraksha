// src/components/shared/OfflineBanner.tsx
import { WifiOff } from 'lucide-react'
import { useSafetyStore } from '../../store/safety.store'

export function OfflineBanner() {
  const isOnline = useSafetyStore((s) => s.isOnline)

  if (isOnline) return null

  return (
    <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center gap-2 text-sm font-medium">
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span>You're offline — trip data cached · SOS via SMS</span>
    </div>
  )
}
