// src/components/GovtLayout.tsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Shield, Map, Bell, TrendingUp, AlertTriangle, LogOut, Activity } from 'lucide-react'
import { useAuthStore } from '../store/auth.store'
import { useSOSSocket } from '../hooks/useSOSSocket'
import { cn } from '../lib/utils'

const NAV_ITEMS = [
  { to: '/', icon: Activity, label: 'Dashboard', exact: true },
  { to: '/sos', icon: Bell, label: 'SOS Management' },
  { to: '/map', icon: Map, label: 'Live Map' },
  { to: '/risk', icon: AlertTriangle, label: 'Risk Overview' },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics' },
]

export default function GovtLayout() {
  const navigate = useNavigate()
  const { logout, govtUser } = useAuthStore()
  const { activeSosCount } = useSOSSocket()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-screen flex bg-surface font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-container-lowest border-r border-outline-variant flex flex-col shadow-sm flex-shrink-0">
        <div className="p-6 border-b border-outline-variant/60">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-display font-black text-on-surface text-base">Aaraksha</p>
              <p className="text-xs text-on-surface-variant">Command Center</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
            <NavLink key={to} to={to} end={exact}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              )}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{label}</span>
              {label === 'SOS Management' && activeSosCount > 0 && (
                <span className="ml-auto bg-sos text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
                  {activeSosCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-outline-variant/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-sm">
              {govtUser?.name?.[0] || 'G'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-on-surface text-sm truncate">{govtUser?.name}</p>
              <p className="text-xs text-on-surface-variant truncate">{govtUser?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-sos font-medium w-full px-3 py-2 rounded-lg hover:bg-sos-light transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
