// src/pages/DashboardPage.tsx
import type { ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, Users, Shield, MapPin, Activity, Download } from 'lucide-react'
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '../components/ui/button'
import { useSOSSocket } from '../hooks/useSOSSocket'
import govtApi from '../api/govt.api'
import { formatTimeAgo } from '../lib/utils'
import type { GovtDashboard } from '../types/api.types'
import type { AnalyticsResponse } from '../api/govt.api'

function StatCard({ label, value, subLabel, trend, trendUp, accentClass, icon: Icon, sparkData }: {
  label: string; value: string | number; subLabel?: string; trend?: string; trendUp?: boolean
  accentClass: string; icon: ComponentType<{ className?: string }>; sparkData?: number[]
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-black text-on-surface">{value}</p>
          {subLabel && <p className="text-xs font-semibold text-primary mt-0.5">{subLabel}</p>}
          {trend && (
            <p className={`text-xs font-semibold mt-1 ${trendUp ? 'text-red-500' : 'text-emerald-500'}`}>
              {trendUp ? '↑' : '↓'} {trend}
            </p>
          )}
        </div>
        {sparkData && (
          <ResponsiveContainer width={100} height={40}>
            <AreaChart data={sparkData.map(v => ({ v }))}>
              <Area type="monotone" dataKey="v"
                stroke={trendUp ? '#ef4444' : '#10b981'}
                fill={trendUp ? '#fef2f2' : '#d1fae5'}
                strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

const SOS_COLORS: Record<string, string> = {
  MEDICAL: '#10b981', LOST: '#475569', TRAPPED: '#f59e0b', DISASTER: '#ef4444',
  MISSING: '#0ea5e9', CRIME: '#7c3aed', OTHER: '#e2e8f0',
}

export default function DashboardPage() {
  useSOSSocket()

  const { data: dashboard } = useQuery({
    queryKey: ['govt', 'dashboard'],
    queryFn: () => govtApi.getDashboard().then(r => r.data.data),
    refetchInterval: 30_000,
  })

  const { data: analytics } = useQuery({
    queryKey: ['govt', 'analytics', '30d'],
    queryFn: () => govtApi.getAnalytics('30d').then(r => r.data.data),
    staleTime: 5 * 60_000,
  })

  const d: GovtDashboard | undefined = dashboard
  const a: AnalyticsResponse | undefined = analytics

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-on-surface">Command Analytics & Reporting</h1>
          <p className="text-on-surface-variant text-sm">Real-time intelligence and incident response metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-container-lowest rounded-full px-4 py-2 shadow-sm border border-outline-variant text-sm font-medium text-on-surface-variant">
            <span>Last 30 days</span>
          </div>
          <Button className="bg-primary-dark hover:brightness-90 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Export PDF
          </Button>
        </div>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-5">
        <StatCard
          label="Total SOS Alerts"
          value={d?.activeSOS ?? 0}
          accentClass="bg-red-100 text-red-600"
          icon={Bell}
          trend={`${d?.activeSOS ?? 0} active`}
          trendUp={(d?.activeSOS ?? 0) > 0}
          sparkData={a?.perDay?.map(p => p.count)}
        />
        <StatCard
          label="Safety Index"
          value={d?.activeSOS === 0 ? '98' : '—'}
          subLabel={d?.activeSOS === 0 ? 'System healthy' : `${d?.activeSOS} incidents active`}
          accentClass="bg-emerald-100 text-primary"
          icon={Shield}
        />
        <StatCard
          label="Active Tourists"
          value={d?.activeTourists ?? 0}
          accentClass="bg-blue-100 text-blue-600"
          icon={Users}
        />
        <StatCard
          label="DMS Monitoring"
          value={d?.activeDMS ?? 0}
          subLabel="Live check-in tracking"
          accentClass="bg-amber-100 text-amber-600"
          icon={Activity}
        />
      </div>

      {/* ── Charts Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 bg-surface-container-lowest rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-on-surface">SOS Incidents Over Time</h2>
            <span className="text-xs font-semibold text-on-surface-variant">Last 30 days</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={a?.perDay || []}>
              <defs>
                <linearGradient id="sosGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tickFormatter={v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2.5}
                fill="url(#sosGrad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-on-surface mb-6">Emergency Types</h2>
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={a?.byCategory || []} cx="50%" cy="50%"
                  innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="count" isAnimationActive={false}>
                  {(a?.byCategory || []).map((entry) => (
                    <Cell key={entry.category} fill={SOS_COLORS[entry.category] || '#e2e8f0'} />
                  ))}
                </Pie>
                <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central" className="fill-slate-900">
                  <tspan x="50%" dy="0" style={{ fontSize: '24px', fontWeight: 900 }}>
                    {a?.totals?.total ?? 0}
                  </tspan>
                  <tspan x="50%" dy="20" style={{ fontSize: '11px', fill: '#94a3b8' }}>TOTAL</tspan>
                </text>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 w-full">
              {Object.entries(SOS_COLORS).slice(0, -1).map(([cat, color]) => (
                <div key={cat} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  {cat}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent SOS ────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-on-surface mb-4">Recent Incidents</h2>
        {d?.recentSOS && d.recentSOS.length > 0 ? (
          <div className="space-y-2">
            {d.recentSOS.map(sos => (
              <div key={sos.id} className="flex items-center gap-4 py-2 border-b border-outline-variant last:border-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sos.status === 'ACTIVE' ? 'bg-sos animate-pulse' : 'bg-green-500'}`} />
                <span className="font-semibold text-on-surface text-sm flex-1">{sos.full_name}</span>
                <span className="text-xs text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">{sos.category}</span>
                <span className="text-xs text-on-surface-variant">{formatTimeAgo(sos.created_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-on-surface-variant">No recent incidents</p>
          </div>
        )}
      </div>
    </div>
  )
}
