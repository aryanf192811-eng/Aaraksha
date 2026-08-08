// src/hooks/useWeatherAlerts.ts
// Listens for WEATHER_RISK_INCREASED on the tourist's own socket room. The
// hourly weather cron already recalculates TSI regardless of whether
// anything changed — this only fires when risk for a destination on the
// tourist's active trip actually got worse since the last poll, so they
// don't have to go check their trip themselves to notice.
import { useEffect } from 'react'
import { toast } from 'sonner'
import { connectSocket } from '../lib/socket'
import { useAuthStore } from '../store/auth.store'
import { queryClient } from '../lib/queryClient'
import { SOCKET_EVENTS } from '../constants/enums'

interface WeatherRiskIncreasedPayload {
  tripId: string
  city: string
  fromRisk: string
  toRisk: string
  reason: string | null
}

const RISK_LABELS: Record<string, string> = {
  LOW: 'Low', MODERATE: 'Moderate', HIGH: 'High', EXTREME: 'Extreme',
}

export function useWeatherAlerts() {
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) return
    const socket = connectSocket('tourist', token)

    const onWeatherRiskIncreased = (data: WeatherRiskIncreasedPayload) => {
      const fromLabel = RISK_LABELS[data.fromRisk] ?? data.fromRisk
      const toLabel = RISK_LABELS[data.toRisk] ?? data.toRisk
      toast.warning(`Weather risk rising in ${data.city}: ${fromLabel} → ${toLabel}`, {
        description: data.reason ?? undefined,
        duration: 12000,
      })
      queryClient.invalidateQueries({ queryKey: ['trips'] })
    }

    socket.on(SOCKET_EVENTS.WEATHER_RISK_INCREASED, onWeatherRiskIncreased)
    return () => { socket.off(SOCKET_EVENTS.WEATHER_RISK_INCREASED, onWeatherRiskIncreased) }
  }, [token])
}
