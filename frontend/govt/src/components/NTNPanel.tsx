// src/components/NTNPanel.tsx
// Live NTN (simulated satellite) network telemetry for the ops dashboard.
// Ticks off NTN_CHANNEL_STATUS (see useSOSSocket.ts) with a polling
// fallback for the recent-activity list. No claim of a real satellite link
// -- see AGENTS.md / the NTN plan for why this is a software simulator.
import { Satellite } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import govtApi from '../api/govt.api'
import { formatTimeAgo } from '../lib/utils'
import type { NTNChannelStatusPayload } from '../hooks/useSOSSocket'

export function NTNPanel({ latest }: { latest: NTNChannelStatusPayload | null }) {
  const { data: recent } = useQuery({
    queryKey: ['govt', 'ntn', 'recent'],
    queryFn: () => govtApi.getRecentNTNActivity().then((r) => r.data.data),
    refetchInterval: 30_000,
  })

  return (
    <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Satellite className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-on-surface">NTN Network (simulated)</h2>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-full">
          Software simulator
        </span>
      </div>

      {latest ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-center">
          <div className="rounded-lg bg-surface-container-high p-2.5">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant">Satellite</p>
            <p className="text-sm font-black text-on-surface">{latest.satelliteId}</p>
          </div>
          <div className="rounded-lg bg-surface-container-high p-2.5">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant">Signal</p>
            <p className="text-sm font-black text-on-surface">{latest.signalPct}%</p>
          </div>
          <div className="rounded-lg bg-surface-container-high p-2.5">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant">Latency</p>
            <p className="text-sm font-black text-on-surface">{latest.latencyMs}ms</p>
          </div>
          <div className="rounded-lg bg-surface-container-high p-2.5">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant">Packet loss</p>
            <p className="text-sm font-black text-on-surface">{latest.packetLossPct}%</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant mb-4">No NTN uplink activity yet this session.</p>
      )}

      {recent && recent.length > 0 && (
        <div className="space-y-1.5">
          {recent.slice(0, 6).map((m) => (
            <div key={m.id} className="flex items-center gap-x-3 gap-y-1 py-1.5 border-b border-outline-variant last:border-0 text-sm">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.status === 'DELIVERED' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="font-semibold text-on-surface flex-1 min-w-[6rem] truncate">{m.tourist_name}</span>
              <span className="text-xs text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">{m.scenario}</span>
              <span className="text-xs text-on-surface-variant ml-auto">{formatTimeAgo(m.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
