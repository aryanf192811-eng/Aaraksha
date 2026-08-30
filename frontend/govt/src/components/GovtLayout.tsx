// src/components/GovtLayout.tsx
import { useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Shield, Map, Bell, TrendingUp, AlertTriangle, LogOut, Activity, ScanLine, Smartphone, Menu, X, HeartHandshake, FileWarning } from 'lucide-react'
import { useAuthStore } from '../store/auth.store'
import { useSOSSocket } from '../hooks/useSOSSocket'
import { ALLOWED_CHECKPOINT_ROLES } from '../pages/CheckpointScanPage'
import { ALLOWED_EFIR_ROLES } from '../pages/IncidentQueuePage'
import govtApi from '../api/govt.api'
import { cn } from '../lib/utils'

const NAV_ITEMS = [
  { to: '/', icon: Activity, label: 'Dashboard', exact: true },
  { to: '/sos', icon: Bell, label: 'SOS Management' },
  { to: '/incidents', icon: FileWarning, label: 'E-FIR Queue' },
  { to: '/volunteers', icon: HeartHandshake, label: 'Volunteers' },
  { to: '/map', icon: Map, label: 'Live Map' },
  { to: '/risk', icon: AlertTriangle, label: 'Risk Overview' },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics' },
]

// Shared between the always-visible desktop sidebar and the mobile slide-in
// drawer so the two never drift out of sync — one source of nav truth,
// two shells around it.
function SidebarContent({ navItems, activeSosCount, pendingVolunteerCount, filedIncidentCount, canScanCheckpoints, onNavigate }: {
  navItems: typeof NAV_ITEMS
  activeSosCount: number
  pendingVolunteerCount: number
  filedIncidentCount: number
  canScanCheckpoints: boolean
  onNavigate?: () => void
}) {
  const navigate = useNavigate()
  const { logout, govtUser } = useAuthStore()
  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <>
      <div className="p-6 border-b border-outline-variant/60">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-display font-black text-on-surface text-base">Aaraksha</p>
            <p className="text-xs text-on-surface-variant">Command Center</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, exact }) => (
          <NavLink key={to} to={to} end={exact} onClick={onNavigate}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all',
              isActive
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            )}>
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span>{label}</span>
            {label === 'SOS Management' && activeSosCount > 0 && (
              <span className="ml-auto bg-sos text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse flex-shrink-0">
                {activeSosCount}
              </span>
            )}
            {label === 'Volunteers' && pendingVolunteerCount > 0 && (
              <span className="ml-auto bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0">
                {pendingVolunteerCount}
              </span>
            )}
            {label === 'E-FIR Queue' && filedIncidentCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0">
                {filedIncidentCount}
              </span>
            )}
          </NavLink>
        ))}

        {/* Only shown to roles that actually staff a checkpoint — opens
            its own mobile-first field-tool view, not part of this sidebar. */}
        {canScanCheckpoints && (
          <button onClick={() => { onNavigate?.(); navigate('/checkpoint') }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all">
            <ScanLine className="w-5 h-5 flex-shrink-0" />
            <span>Checkpoint Scan</span>
            <Smartphone className="w-3.5 h-3.5 ml-auto opacity-50 flex-shrink-0" />
          </button>
        )}
      </nav>

      <div className="p-4 border-t border-outline-variant/60">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
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
    </>
  )
}

export default function GovtLayout() {
  const { govtUser } = useAuthStore()
  const { activeSosCount } = useSOSSocket()
  const canScanCheckpoints = !!govtUser && ALLOWED_CHECKPOINT_ROLES.includes(govtUser.role)
  // E-FIR routes are now restricted server-side to investigating roles
  // (POLICE/DISTRICT_ADMIN/SUPER_ADMIN) -- hide the nav link entirely for
  // TOURISM_OFFICER/MEDICAL/CHECKPOINT_OFFICER rather than showing a queue
  // link that would 403 on every request.
  const canViewEfirs = !!govtUser && ALLOWED_EFIR_ROLES.includes(govtUser.role)
  const navItems = NAV_ITEMS.filter(n => n.label !== 'E-FIR Queue' || canViewEfirs)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const activeLabel = navItems.find(n => (n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to)))?.label ?? 'Dashboard'

  // <main> below is its own scroll container, not the window — React Router
  // doesn't reset scroll position on navigation, so a new page used to
  // render already scrolled to wherever the previous page was left,
  // hiding its own heading under whatever content used to be at that offset.
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  // Nav badge only — VolunteersPage runs its own query for the actual list.
  const { data: pendingVolunteers } = useQuery({
    queryKey: ['govt', 'volunteers', 'pending'],
    queryFn: () => govtApi.getPendingVolunteers().then(r => r.data.data),
    refetchInterval: 30_000,
  })
  const pendingVolunteerCount = pendingVolunteers?.length ?? 0

  // Nav badge only — IncidentQueuePage runs its own query for the full
  // queue. Gated on canViewEfirs — this route now 403s for roles that
  // can't view E-FIRs at all, and there's no badge to show them anyway
  // since the nav link itself is hidden.
  const { data: filedIncidents } = useQuery({
    queryKey: ['govt', 'incidents', 'FILED', false],
    queryFn: () => govtApi.getIncidentQueue({ status: 'FILED', limit: 50 }).then(r => r.data),
    refetchInterval: 30_000,
    enabled: canViewEfirs,
  })
  const filedIncidentCount = filedIncidents?.pagination.total ?? 0

  return (
    <div className="min-h-screen flex bg-surface font-sans">
      {/* Desktop sidebar — always visible from lg up, hidden below it */}
      <aside className="hidden lg:flex w-64 bg-surface-container-lowest border-r border-outline-variant flex-col shadow-sm flex-shrink-0">
        <SidebarContent navItems={navItems} activeSosCount={activeSosCount} pendingVolunteerCount={pendingVolunteerCount} filedIncidentCount={filedIncidentCount} canScanCheckpoints={canScanCheckpoints} />
      </aside>

      {/* Mobile slide-in drawer + backdrop */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setDrawerOpen(false)} />
      )}
      <aside className={cn(
        'lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-surface-container-lowest border-r border-outline-variant flex flex-col shadow-xl transition-transform duration-200 ease-out',
        drawerOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <button onClick={() => setDrawerOpen(false)} aria-label="Close menu"
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container">
          <X className="w-5 h-5" />
        </button>
        <SidebarContent navItems={navItems} activeSosCount={activeSosCount} pendingVolunteerCount={pendingVolunteerCount} filedIncidentCount={filedIncidentCount} canScanCheckpoints={canScanCheckpoints} onNavigate={() => setDrawerOpen(false)} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar — hidden from lg up, where the static sidebar takes over */}
        <header className="lg:hidden sticky top-0 z-30 bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
          <button onClick={() => setDrawerOpen(true)} aria-label="Open menu"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container flex-shrink-0 relative">
            <Menu className="w-5 h-5" />
            {activeSosCount > 0 && (
              <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-sos animate-pulse" />
            )}
          </button>
          <div className="min-w-0">
            <p className="font-display font-black text-on-surface text-sm leading-tight truncate">{activeLabel}</p>
            <p className="text-[11px] text-on-surface-variant leading-tight">Aaraksha Command Center</p>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
