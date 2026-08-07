// src/components/shared/WeatherBadge.tsx
import { Cloud, Sun, CloudRain, Zap, Wind, CloudSnow } from 'lucide-react'
import { cn } from '../../lib/utils'

const WEATHER_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  CLEAR:      { icon: Sun,       color: 'text-amber-500', label: 'Clear' },
  CLOUDY:     { icon: Cloud,     color: 'text-on-surface-variant', label: 'Cloudy' },
  RAIN:       { icon: CloudRain, color: 'text-blue-500',  label: 'Rain' },
  HEAVY_RAIN: { icon: CloudRain, color: 'text-blue-700',  label: 'Heavy Rain' },
  STORM:      { icon: Zap,       color: 'text-red-500',   label: 'Storm' },
  FOG:        { icon: Wind,      color: 'text-on-surface-variant', label: 'Fog' },
  SNOW:       { icon: CloudSnow, color: 'text-blue-300',  label: 'Snow' },
}

export function WeatherBadge({ condition, tempCelsius, riskReason }: {
  condition?: string; tempCelsius?: number; riskReason?: string | null
}) {
  const config = WEATHER_CONFIG[condition || 'CLEAR'] || WEATHER_CONFIG.CLEAR
  const Icon = config.icon
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn('w-4 h-4', config.color)} />
      <span className="text-sm font-medium text-on-surface">{config.label}</span>
      {tempCelsius !== undefined && <span className="text-sm text-on-surface-variant">{tempCelsius}°C</span>}
      {riskReason && <span className="text-xs text-orange-600 font-medium">{riskReason}</span>}
    </div>
  )
}
