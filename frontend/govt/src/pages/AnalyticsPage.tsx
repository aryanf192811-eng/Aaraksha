// src/pages/AnalyticsPage.tsx — full analytics view with period selector
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
         ResponsiveContainer, CartesianGrid } from 'recharts'
import { Button } from '../components/ui/button'
import govtApi, { type AnalyticsResponse } from '../api/govt.api'
import { cn } from '../lib/utils'

const PERIOD_OPTIONS = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
]

const CATEGORY_COLORS = [
  { color: '#10b981', name: 'Medical' },
  { color: '#475569', name: 'Lost' },
  { color: '#f59e0b', name: 'Trapped' },
  { color: '#ef4444', name: 'Disaster' },
  { color: '#0ea5e9', name: 'Missing' },
  { color: '#7c3aed', name: 'Crime' },
  { color: '#e2e8f0', name: 'Other' },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d')

  const { data: analytics } = useQuery({
    queryKey: ['govt', 'analytics', period],
    queryFn: () => govtApi.getAnalytics(period).then(r => r.data.data),
  })

  const a: AnalyticsResponse | undefined = analytics
  const perDay      = a?.perDay ?? []
  const byCategory   = a?.byCategory ?? []
  const totals       = a?.totals ?? { total: 0, resolved: 0, active: 0 }
  const avgResponse  = a?.avgResponseMinutes ?? 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-on-surface">Command Analytics & Reporting</h1>
          <p className="text-on-surface-variant text-sm">Real-time intelligence and incident response metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-surface-container-lowest rounded-full p-1 shadow-sm border border-outline-variant">
            {PERIOD_OPTIONS.map(({ label, value }) => (
              <button key={value} onClick={() => setPeriod(value)}
                className={cn('px-4 py-1.5 rounded-full text-sm font-semibold transition-all',
                  period === value ? 'bg-primary-dark text-white' : 'text-on-surface-variant hover:text-on-surface'
                )}>
                {label}
              </button>
            ))}
          </div>
          <Button className="bg-primary-dark hover:brightness-90 text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2">
            <Download className="w-4 h-4" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Incidents', value: totals.total, color: 'text-on-surface' },
          { label: 'Resolved', value: totals.resolved, color: 'text-green-600' },
          { label: 'Still Active', value: totals.active, color: 'text-red-600' },
          { label: 'Avg Response', value: `${avgResponse}min`, color: 'text-primary' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface-container-lowest rounded-xl p-5 shadow-sm text-center">
            <p className={cn('text-3xl font-black', color)}>{value}</p>
            <p className="text-xs text-on-surface-variant font-medium mt-1 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 bg-surface-container-lowest rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-on-surface mb-6">SOS Incidents Over Time</h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={perDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day"
                tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                formatter={(value) => [value, 'Incidents']}
                labelFormatter={(label) => typeof label === 'string' ? new Date(label).toLocaleDateString('en-IN') : label} />
              <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2.5}
                fill="url(#areaGrad)" dot={false} isAnimationActive={false} name="Incidents" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-on-surface mb-4">Emergency Types</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byCategory.length > 0 ? byCategory : [{ category: 'NONE', count: 1 }]}
                cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                paddingAngle={2} dataKey="count" isAnimationActive={false}>
                {(byCategory.length > 0 ? byCategory : [{ category: 'NONE', count: 1 }]).map((entry, idx) => (
                  <Cell key={entry.category} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length].color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {byCategory.map((cat, idx) => (
              <div key={cat.category} className="flex items-center gap-2 text-xs text-on-surface-variant">
                <div className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length].color }} />
                <span>{cat.category}</span>
                <span className="ml-auto font-semibold">{cat.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-on-surface mb-6">Incidents by Category</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byCategory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} isAnimationActive={false} name="Incidents" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
