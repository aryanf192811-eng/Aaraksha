// src/hooks/useBattery.ts
import { useState, useEffect } from 'react'

// BatteryManager type for TypeScript — not in lib.dom.d.ts
interface BatteryManager extends EventTarget {
  level: number
  charging: boolean
  onlevelchange: ((this: BatteryManager, ev: Event) => unknown) | null
  onchargingchange: ((this: BatteryManager, ev: Event) => unknown) | null
}

export function useBattery(): { batteryPct: number | null; isCharging: boolean | null } {
  const [batteryPct, setBatteryPct] = useState<number | null>(null)
  const [isCharging, setIsCharging] = useState<boolean | null>(null)

  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as Navigator & { getBattery: () => Promise<BatteryManager> })
        .getBattery()
        .then((battery) => {
          setBatteryPct(Math.round(battery.level * 100))
          setIsCharging(battery.charging)
          battery.onlevelchange = () => setBatteryPct(Math.round(battery.level * 100))
          battery.onchargingchange = () => setIsCharging(battery.charging)
        })
        .catch(() => {})
    }
  }, [])

  return { batteryPct, isCharging }
}
