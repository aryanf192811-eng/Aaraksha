// src/components/shared/BottomNav.tsx
// Design: Stitch bottom nav — active item gets a filled pill background.
// Profile dropped as a tab (already reachable via the avatar in Dashboard's
// header — see DashboardPage.tsx) to make room for a raised center SOS
// button (NavSOSButton), reachable from every route now instead of only
// the Dashboard, matching Uber/food-delivery apps' central-action pattern.
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Map, MapPin, Globe } from 'lucide-react'
import { NavSOSButton } from './NavSOSButton'
import { cn } from '../../lib/utils'

const NAV_ITEMS = [
  { Icon: Home,   labelKey: 'nav.home',      route: '/dashboard' },
  { Icon: Map,    labelKey: 'nav.trips',     route: '/trips' },
  null, // center slot — NavSOSButton renders here, raised above the bar
  { Icon: MapPin, labelKey: 'nav.checkIn',   route: '/checkin' },
  { Icon: Globe,  labelKey: 'nav.community', route: '/community' },
]

export function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t } = useTranslation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl bg-surface border-t border-outline-variant shadow-lg">
      <div className="relative grid grid-cols-5 max-w-lg mx-auto px-1 py-2 pb-safe">
        {NAV_ITEMS.map((item) => {
          if (!item) return <div key="sos-slot" />
          const { Icon, labelKey, route } = item
          const active = pathname === route
          return (
            <button key={route} onClick={() => navigate(route)}
              className={cn('flex flex-col items-center py-1.5 mx-0.5 gap-0.5 rounded-full transition-all',
                active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'
              )}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">{t(labelKey)}</span>
            </button>
          )
        })}
        <NavSOSButton />
      </div>
    </nav>
  )
}
