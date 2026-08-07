// src/components/shared/BottomNav.tsx
// Design: Stitch bottom nav — active item gets a filled pill background.
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Map, MapPin, Globe, User } from 'lucide-react'
import { cn } from '../../lib/utils'

const NAV_ITEMS = [
  { Icon: Home,   label: 'Home',      route: '/dashboard' },
  { Icon: Map,    label: 'Trips',     route: '/trips' },
  { Icon: MapPin, label: 'Check In',  route: '/checkin' },
  { Icon: Globe,  label: 'Community', route: '/community' },
  { Icon: User,   label: 'Profile',   route: '/profile' },
]

export function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl bg-surface border-t border-outline-variant shadow-lg">
      <div className="grid grid-cols-5 max-w-lg mx-auto px-1 py-2 pb-safe">
        {NAV_ITEMS.map(({ Icon, label, route }) => {
          const active = pathname === route
          return (
            <button key={route} onClick={() => navigate(route)}
              className={cn('flex flex-col items-center py-1.5 mx-0.5 gap-0.5 rounded-full transition-all',
                active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'
              )}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
