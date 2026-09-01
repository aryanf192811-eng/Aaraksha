// src/components/shared/NTNDemoPanel.tsx
// A presenter-only control, gated behind VITE_ENABLE_NTN_DEMO, for
// demonstrating the simulated NTN (satellite) SOS transport. Deliberately
// NOT wired into useSOS.ts's real online/offline branching -- a genuinely
// offline device cannot reach ANY backend endpoint, simulated satellite
// hop or not, so chaining "try NTN when offline" into that hook would be
// self-contradictory. This button is its own explicit path: it always
// uses whatever real network the device has (the venue's Wi-Fi during a
// demo) to reach the backend's NTN simulator, which is honest -- in the
// real 3GPP NTN model, the tourist's *phone* has no terrestrial signal,
// but the satellite's ground gateway does have real internet backhaul,
// which is what the data ultimately rides on. See AGENTS.md / the NTN
// plan for the full reasoning.
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Satellite, Loader2, SignalHigh, SignalLow, SignalZero } from 'lucide-react'
import ntnApi, { type NTNScenario } from '../../api/ntn.api'
import { getErrorMessage } from '../../api/client'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useBattery } from '../../hooks/useBattery'
import { useSafetyStore } from '../../store/safety.store'
import { queryClient } from '../../lib/queryClient'
import { cn } from '../../lib/utils'
import type { SOSCategory } from '../../constants/enums'

const SCENARIOS: { value: NTNScenario; label: string; hint: string; Icon: typeof SignalHigh }[] = [
  { value: 'CLEAR_SKY',       label: 'Clear sky',      hint: 'Strong signal, low latency',      Icon: SignalHigh },
  { value: 'MOUNTAIN_VALLEY', label: 'Mountain valley', hint: 'Weak signal, higher latency/loss', Icon: SignalLow },
  { value: 'NO_VISIBILITY',   label: 'No visibility',  hint: 'Satellite unreachable — fails',    Icon: SignalZero },
]

export function isNTNDemoEnabled() {
  return import.meta.env.VITE_ENABLE_NTN_DEMO === 'true'
}

interface NTNDemoPanelProps {
  category: SOSCategory
  message?: string
}

export function NTNDemoPanel({ category, message }: NTNDemoPanelProps) {
  const [scenario, setScenario] = useState<NTNScenario>('CLEAR_SKY')
  const { getPosition } = useGeolocation()
  const { batteryPct } = useBattery()
  const setActiveSOSId = useSafetyStore((s) => s.setActiveSOSId)

  const { mutate: sendViaNTN, isPending, data: lastResult } = useMutation({
    mutationFn: async () => {
      const position = await getPosition()
      return ntnApi.sendUplink({
        scenario,
        latitude: position.latitude,
        longitude: position.longitude,
        locationAccuracyM: position.accuracy || null,
        isStaleLocation: position.isStale,
        category,
        message: message || null,
        batteryPct,
      }).then((r) => r.data.data)
    },
    onSuccess: (result) => {
      if (result.delivered && result.sosEvent) {
        setActiveSOSId(result.sosEvent.id)
        queryClient.invalidateQueries({ queryKey: ['sos', 'mine'] })
        queryClient.invalidateQueries({ queryKey: ['sos', 'active-rescue'] })
        toast.success('SOS delivered via simulated NTN uplink. Emergency contacts notified.')
      } else {
        toast.error('NTN uplink failed — no satellite visibility or packet lost.')
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div className="rounded-2xl p-5 shadow-sm border-2 border-dashed border-primary/40 bg-primary/5">
      <div className="flex items-center gap-3 mb-1">
        <Satellite className="w-6 h-6 text-primary" />
        <div>
          <h2 className="font-display font-black text-on-surface">Demo: NTN satellite uplink</h2>
          <p className="text-xs text-on-surface-variant">
            Presenter control — sends via the simulated satellite transport, independent of real connectivity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 my-4">
        {SCENARIOS.map(({ value, label, hint, Icon }) => (
          <button key={value} type="button" onClick={() => setScenario(value)}
            className={cn(
              'rounded-xl border-2 p-2.5 flex flex-col items-center gap-1 text-center transition-all',
              scenario === value ? 'border-primary bg-primary/10' : 'border-outline-variant bg-surface-container-lowest'
            )}>
            <Icon className={cn('w-4 h-4', scenario === value ? 'text-primary' : 'text-on-surface-variant')} />
            <span className="text-[11px] font-bold text-on-surface leading-tight">{label}</span>
            <span className="text-[9px] text-on-surface-variant leading-tight">{hint}</span>
          </button>
        ))}
      </div>

      <button onClick={() => sendViaNTN()} disabled={isPending}
        className="w-full bg-primary hover:brightness-95 text-primary-foreground font-bold rounded-full h-11 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60">
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Satellite className="w-4 h-4" />}
        Send via simulated NTN
      </button>

      {lastResult && (
        <div className={cn('mt-3 rounded-xl p-3 text-xs font-mono',
          lastResult.delivered ? 'bg-tsi-low/10 text-tsi-low' : 'bg-sos/10 text-sos-dark'
        )}>
          {lastResult.delivered ? 'DELIVERED' : 'FAILED'} · {lastResult.channel.satelliteId} ·
          {' '}signal {lastResult.channel.signalPct}% · {lastResult.channel.latencyMs}ms ·
          {' '}loss {lastResult.channel.packetLossPct}%
        </div>
      )}
    </div>
  )
}
