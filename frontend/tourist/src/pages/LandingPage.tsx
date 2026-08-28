// src/pages/LandingPage.tsx
// Design concept: "Terrain profile" — Northeast India's identity is its
// elevation change (Brahmaputra floodplain to 3000m+ passes), and that's
// also literally what TSI measures per-destination (altitude_m, zone_type,
// difficulty). A layered contour/ridgeline motif carries the page instead
// of the generic radial-gradient hero + icon-bento-grid template, and the
// destination strip below uses real seeded data (altitude, zone, ILP)
// rather than filler copy.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, ShieldCheck, ArrowRight, Users,
  Radio, Siren, Timer, BarChart3, WifiOff, MessageSquareWarning,
  MapPinned, ClipboardList, CheckCircle2, FlagTriangleRight, Navigation, Plus,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAuthStore } from '../store/auth.store'
import { getDestinationImage, HERO_PHOTO } from '../lib/destinationImages'
import { cn } from '../lib/utils'

// Real seeded values (backend/scripts/seed.js) — the terrain strip is a
// product-data visualization, not decorative filler.
const TERRAIN_STOPS = [
  { city: 'Kaziranga', state: 'Assam', altitude: 80, zone: 'SAFE', note: 'Floodplain · easy access' },
  { city: 'Cherrapunji (Sohra)', state: 'Meghalaya', altitude: 1484, zone: 'CAUTION', note: 'Wettest place on Earth' },
  { city: 'Dzukou Valley', state: 'Nagaland', altitude: 2452, zone: 'HIGH_RISK', note: 'No network past base camp' },
  { city: 'Tawang', state: 'Arunachal Pradesh', altitude: 3048, zone: 'ILP_REQUIRED', note: 'Sela Pass · permit required' },
]

const ZONE_STYLES: Record<string, string> = {
  SAFE: 'bg-safe/10 text-safe border-safe/30',
  CAUTION: 'bg-primary/10 text-primary-dark border-primary/30',
  HIGH_RISK: 'bg-sos/10 text-sos border-sos/30',
  ILP_REQUIRED: 'bg-slate-500/10 text-slate-600 border-slate-400/30',
}

// Layered topographic contour lines — reused behind the hero and as a
// footer echo. Hand-authored bezier waves, not a stock gradient blob.
function ContourLines({ className = '' }: { className?: string }) {
  const rows = [
    { y: 40,  opacity: 0.5,  color: '#f59e0b' },
    { y: 95,  opacity: 0.35, color: '#4d7c5f' },
    { y: 150, opacity: 0.28, color: '#f59e0b' },
    { y: 205, opacity: 0.18, color: '#4d7c5f' },
  ]
  return (
    <svg viewBox="0 0 1200 260" className={className} preserveAspectRatio="none" aria-hidden="true">
      {rows.map((r, i) => (
        <path
          key={i}
          d={`M-20,${r.y} C 100,${r.y - 34} 220,${r.y + 34} 340,${r.y} C 460,${r.y - 34} 580,${r.y + 34} 700,${r.y} C 820,${r.y - 34} 940,${r.y + 34} 1060,${r.y} C 1140,${r.y - 20} 1180,${r.y + 10} 1220,${r.y}`}
          fill="none"
          stroke={r.color}
          strokeOpacity={r.opacity}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  )
}


// Signal-strength collapse, rendered as the actual data it represents (bars
// dropping toward the last tower) rather than a generic "icon → arrow →
// icon" flow — dark card deliberately breaks from the white-card rhythm of
// the other rows, since this is the one genuinely urgent mechanism.
function SignalDropCard() {
  const bars = [88, 63, 42, 24, 10, 0]
  return (
    <div className="relative rounded-2xl bg-slate-950 p-5 w-72 shadow-glass-lg overflow-hidden">
      <ContourLines className="absolute inset-x-0 bottom-0 w-full h-16 opacity-[0.15]" />
      <div className="relative flex items-center justify-between mb-4">
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-white/50">Signal strength</span>
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-sos-light flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-sos animate-pulse" /> Lost at 41km
        </span>
      </div>
      <div className="relative flex items-end gap-1.5 h-14 mb-4">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 h-full flex items-end">
            {h > 0 ? (
              <div className="w-full rounded-t-[3px]" style={{ height: `${h}%`, background: `rgba(255,255,255,${0.2 + (h / 100) * 0.6})` }} />
            ) : (
              <div className="w-full h-2.5 rounded-[3px] border border-dashed border-sos/70" />
            )}
          </div>
        ))}
      </div>
      <div className="relative flex items-center gap-2.5 pt-3.5 border-t border-white/10">
        <div className="w-8 h-8 rounded-full bg-sos/20 flex items-center justify-center flex-shrink-0">
          <MessageSquareWarning className="w-4 h-4 text-sos-light" />
        </div>
        <div>
          <p className="text-xs font-bold text-white leading-tight">Structured SMS sent</p>
          <p className="text-[10px] text-white/50 leading-tight">via satellite GPS · no data needed</p>
        </div>
      </div>
    </div>
  )
}

// Instrument-style countdown — tick marks and a two-stop gradient stroke so
// it reads as a real dial (a watch bezel, a kitchen timer) rather than a
// bare Material "circular progress" widget copy-pasted three times over.
function DMSDial() {
  const ticks = Array.from({ length: 24 })
  return (
    <div className="relative rounded-2xl bg-surface-container-lowest border border-outline-variant p-6 flex flex-col items-center gap-3 w-60 shadow-sm overflow-hidden">
      <ContourLines className="absolute inset-x-0 bottom-0 w-full h-10 opacity-[0.12]" />
      <div className="relative w-28 h-28 flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="dmsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          {ticks.map((_, i) => (
            <line key={i} x1="50" y1="3" x2="50" y2={i % 6 === 0 ? '9' : '6.5'} stroke="#cbd5e1"
              strokeWidth={i % 6 === 0 ? 1.4 : 0.8} transform={`rotate(${(i / ticks.length) * 360} 50 50)`} />
          ))}
          <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="6" className="text-surface-container-high" />
          <circle cx="50" cy="50" r="38" fill="none" stroke="url(#dmsGradient)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray="238.8" strokeDashoffset="171" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-base font-black text-on-surface">04:20</span>
          <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-wide">to check-in</span>
        </div>
      </div>
      <div className="relative flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span className="text-[10px] font-bold text-on-surface-variant">Auto-alerts on timeout</span>
      </div>
    </div>
  )
}

// A real road-route sketch — traveled distance solid, remaining dashed, a
// directional "puck" at the live position and a proper pin at the
// destination — instead of one flat dashed line between two plain dots.
function RescuerRouteCard() {
  return (
    <div className="relative rounded-2xl bg-surface-container-lowest border border-outline-variant p-4 w-72 shadow-sm overflow-hidden">
      <svg className="absolute inset-0 w-full h-full opacity-[0.35]" aria-hidden="true">
        <pattern id="routeDotGrid" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1.4" cy="1.4" r="1" fill="#cbd5e1" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#routeDotGrid)" />
      </svg>
      <div className="relative flex items-center gap-1.5 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-safe animate-pulse" />
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-on-surface-variant">Live · rescuer en route</span>
      </div>
      <svg viewBox="0 0 240 100" className="relative w-full h-20" aria-hidden="true">
        <path d="M18,78 C 55,35 95,70 128,42" fill="none" stroke="#0d9488" strokeWidth="3" strokeLinecap="round" />
        <path d="M128,42 C 160,20 190,55 220,18" fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="1 7" strokeLinecap="round" />
        <circle cx="18" cy="78" r="9" fill="#0d9488" fillOpacity="0.18" />
        <circle cx="18" cy="78" r="5" fill="#0d9488" />
        <g transform="translate(128 42) rotate(35)">
          <circle r="11" fill="#0d9488" fillOpacity="0.15" />
          <path d="M0,-6.5 L5.5,5.5 L0,2 L-5.5,5.5 Z" fill="#0d9488" />
        </g>
        <path d="M220,2 c6.5,0 11,4.7 11,10.6 c0,7.9 -11,19 -11,19 s-11,-11.1 -11,-19 c0,-5.9 4.5,-10.6 11,-10.6 z" fill="#f59e0b" />
        <circle cx="220" cy="13" r="3.6" fill="white" />
      </svg>
      <div className="relative flex justify-between mt-1 px-0.5">
        <p className="text-[11px] font-bold text-on-surface">You</p>
        <p className="text-[11px] font-bold text-trust">1.8 km · 6 min out</p>
      </div>
    </div>
  )
}

// Vertical bar comparison, not a third instance of the same radial gauge
// already used for the hero stat and the DMS dial — a real chart (gradient
// fill, baseline, labels) earns the "shown as it runs" claim better than
// three identical rings ever could.
function TSIBarChart() {
  const data = [
    { label: 'Kaziranga', score: 91, from: '#22c55e', to: '#15803d' },
    { label: 'Sohra', score: 68, from: '#f59e0b', to: '#a16207' },
    { label: 'Tawang', score: 44, from: '#f97316', to: '#c2410c' },
  ]
  return (
    <div className="relative rounded-2xl bg-surface-container-lowest border border-outline-variant p-5 w-64 shadow-sm">
      <div className="flex items-end justify-between gap-4 h-28 mb-1">
        {data.map(d => (
          <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
            <span className="text-xs font-black text-on-surface">{d.score}</span>
            <div className="w-full rounded-t-md" style={{ height: `${d.score}%`, background: `linear-gradient(180deg, ${d.from}, ${d.to})` }} />
          </div>
        ))}
      </div>
      <div className="h-px bg-outline-variant mb-2" />
      <div className="flex justify-between gap-4">
        {data.map(d => (
          <span key={d.label} className="flex-1 text-center text-[9px] font-bold text-on-surface-variant uppercase tracking-wide truncate">{d.label}</span>
        ))}
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const hasHydrated = useAuthStore(s => s.hasHydrated)
  const [scrolledPastHero, setScrolledPastHero] = useState(false)

  // The installed PWA's start_url is "/" — this page — so a returning,
  // already-logged-in tourist reopening the app landed on the marketing
  // splash every time, with a manual "Dashboard" tap required to actually
  // continue in. That reads exactly like being logged out even though the
  // IndexedDB-persisted session was fine the whole time. Gated on
  // hasHydrated so this doesn't fire against the default (not-yet-loaded)
  // isAuthenticated:false before the async IndexedDB read resolves.
  useEffect(() => {
    if (hasHydrated && isAuthenticated) navigate('/dashboard', { replace: true })
  }, [hasHydrated, isAuthenticated, navigate])

  // The hero is dark photography full-bleed from the true top of the
  // screen — the header has no background of its own while over it (the
  // hero's own top-down scrim below provides contrast) and only becomes a
  // solid bar once scrolled onto the light content beneath. Avoids relying
  // on backdrop-filter transparency, which didn't render as intended in
  // the installed PWA on a real device (showed as a flat opaque bar
  // instead of blurring the photo through it).
  useEffect(() => {
    const onScroll = () => setScrolledPastHero(window.scrollY > 64)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Status bar / PWA chrome color matches the dark hero photo while it's
  // showing, then reverts to the brand amber used everywhere else in the
  // app — otherwise the OS status bar renders as a bright amber band that
  // visually fights the photo instead of sitting on top of it.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    const original = meta?.getAttribute('content')
    meta?.setAttribute('content', '#0f172a')
    return () => { if (original) meta?.setAttribute('content', original) }
  }, [])

  // Same gate PrivateRoute uses — render nothing for the one brief tick
  // before IndexedDB hydration resolves, rather than flashing the full
  // marketing hero at a returning, already-logged-in tourist right before
  // redirecting them away from it.
  if (!hasHydrated) return null

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans antialiased">
      {/* ── TopAppBar — transparent over the hero, solid once scrolled past it ── */}
      <header className={cn(
        'fixed top-0 w-full z-50 transition-colors duration-300',
        scrolledPastHero ? 'bg-surface shadow-sm' : 'bg-transparent'
      )}>
        <div className="flex justify-between items-center px-5 py-2.5 w-full max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <Shield className={cn('w-6 h-6', scrolledPastHero ? 'text-primary' : 'text-white')} />
            <h1 className={cn('font-display text-xl font-black tracking-tight', scrolledPastHero ? 'text-primary' : 'text-white')}>Aaraksha</h1>
          </div>
          <nav className="hidden md:flex gap-2 items-center">
            <a className={cn('text-sm font-semibold transition-colors px-4 py-2 rounded-full', scrolledPastHero ? 'text-primary hover:bg-surface-container/70' : 'text-white hover:bg-white/10')} href="#terrain">Terrain</a>
            <a className={cn('text-sm font-semibold transition-colors px-4 py-2 rounded-full', scrolledPastHero ? 'text-on-surface-variant hover:bg-surface-container/70' : 'text-white/85 hover:bg-white/10')} href="#features">Features</a>
            <a className={cn('text-sm font-semibold transition-colors px-4 py-2 rounded-full', scrolledPastHero ? 'text-on-surface-variant hover:bg-surface-container/70' : 'text-white/85 hover:bg-white/10')} href="#steps">How it Works</a>
          </nav>
          {isAuthenticated ? (
            <Button onClick={() => navigate('/dashboard')}
              className="bg-primary text-primary-foreground rounded-full px-6 font-semibold text-sm">
              Dashboard
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => navigate('/auth')}
                className={cn('hidden sm:inline-flex font-semibold', scrolledPastHero ? 'text-on-surface-variant' : 'text-white hover:bg-white/10 hover:text-white')}>Log In</Button>
              <Button onClick={() => navigate('/auth?tab=register')}
                className="bg-primary text-primary-foreground px-6 rounded-full font-semibold text-sm hover:scale-[1.02] active:scale-95 transition-all">
                Get Started
              </Button>
            </div>
          )}
        </div>
      </header>

      <main>
        {/* ── Hero — full-bleed splash, tourist-only: no outbound portal link ── */}
        <section className="relative min-h-[100dvh] md:min-h-[88vh] flex flex-col justify-end overflow-hidden isolate">
          <img src={HERO_PHOTO} alt="A trekker on a misty mountain trail in Northeast India" loading="eager"
            className="absolute inset-0 w-full h-full object-cover" />
          {/* Top-down scrim (header legibility) + bottom-up scrim (headline legibility), one gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-transparent h-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/35 to-slate-950/10" />

          {/* Floating stat card — one real, live-feeling data point over the photo,
              same "glass card over photography" language as the trip hero on Home. */}
          <div className="relative px-5 md:px-6 max-w-6xl mx-auto w-full mb-6 hidden sm:flex justify-end">
            <div className="glass-card rounded-2xl p-3.5 flex items-center gap-3 shadow-glass-lg">
              <div className="relative w-12 h-12 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="5" className="text-surface-container-high" />
                  <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray="113" strokeDashoffset="30" className="text-tsi-low" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[13px] font-black text-white">73</span>
                </div>
              </div>
              <div className="pr-1">
                <p className="text-[11px] font-bold text-white leading-tight">Dzukou Valley</p>
                <p className="text-[10px] text-white/70 leading-tight">2452m · TSI updated hourly</p>
              </div>
            </div>
          </div>

          <div className="relative px-5 md:px-6 max-w-6xl mx-auto w-full pb-10 md:pb-16">
            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 mb-5">
              <span className="w-2 h-2 rounded-full bg-safe animate-pulse" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-white">Live Protection Active</span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl md:text-[3.4rem] font-black text-white leading-[1.05] tracking-tight max-w-2xl">
              Every valley, pass, and river island<span className="text-primary"> scored before you go.</span>
            </h2>
            <p className="text-base text-white/80 max-w-md leading-relaxed mt-4">
              Northeast India ranges from Brahmaputra floodplains to 3000m Himalayan passes.
              Aaraksha tracks the terrain you're actually entering, and keeps working even
              where the signal doesn't.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-7 w-full sm:w-auto">
              <Button onClick={() => navigate('/auth?tab=register')}
                className="bg-primary text-primary-foreground px-8 h-14 rounded-full font-semibold text-base shadow-glass active:scale-95 transition-all">
                Get Started <ArrowRight className="ml-1.5 w-4 h-4" />
              </Button>
              <Button onClick={() => navigate('/auth')} variant="outline"
                className="bg-white/10 text-white border-white/30 backdrop-blur-md px-8 h-14 rounded-full font-semibold text-base hover:bg-white/20 hover:text-white active:scale-95 transition-all">
                Log In
              </Button>
            </div>
          </div>
        </section>

        {/* ── Terrain strip: real destinations, real elevation/zone data ── */}
        <section id="terrain" className="py-14 md:py-20 scroll-mt-20 max-w-6xl mx-auto px-5 md:px-6">
          <div className="mb-8">
            <p className="text-xs font-extrabold text-primary uppercase tracking-widest mb-1.5">The terrain you're entering</p>
            <h2 className="font-display text-2xl md:text-3xl font-black text-on-surface max-w-xl">
              From an 80m floodplain to a 3048m mountain pass — same app, same TSI engine.
            </h2>
          </div>

          {/* elevation axis connecting the four stops */}
          <div className="relative mb-3 hidden sm:block px-2">
            <svg viewBox="0 0 800 60" className="w-full h-12" preserveAspectRatio="none" aria-hidden="true">
              <path d="M20,50 L220,44 L420,22 L780,8" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
              {[[20, 50], [220, 44], [420, 22], [780, 8]].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="4" fill="#f59e0b" />
              ))}
            </svg>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TERRAIN_STOPS.map((stop) => (
              <div key={stop.city}
                className="group relative rounded-2xl overflow-hidden aspect-[4/5] shadow-sm hover:shadow-lg transition-shadow cursor-pointer border border-outline-variant"
                onClick={() => navigate('/auth?tab=register')}>
                <img src={getDestinationImage(stop.city, { w: 1000, q: 82 })} alt={stop.city}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full border text-[10px] font-extrabold backdrop-blur-sm ${ZONE_STYLES[stop.zone]}`}>
                  {stop.zone.replace('_', ' ')}
                </div>
                <div className="absolute bottom-0 inset-x-0 p-4">
                  <p className="font-display text-lg font-black text-white leading-tight">{stop.city}</p>
                  <p className="text-xs text-white/70 font-medium">{stop.state} · {stop.altitude}m</p>
                  <p className="text-[11px] text-white/60 mt-1">{stop.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Mechanism rows (replaces generic bento grid) ────────────── */}
        <section id="features" className="py-14 md:py-20 scroll-mt-20 max-w-6xl mx-auto px-5 md:px-6">
          <div className="mb-10">
            <h3 className="font-display text-3xl font-black text-on-surface mb-2">How the safety net actually works</h3>
            <p className="text-on-surface-variant max-w-lg">Five mechanisms, shown as they run — not just named.</p>
          </div>

          <div className="flex flex-col divide-y divide-outline-variant">
            {/* Offline SOS */}
            <div className="py-7 grid md:grid-cols-2 gap-6 items-center">
              <div>
                <Radio className="w-7 h-7 text-sos mb-3" />
                <h4 className="text-xl font-bold text-on-surface mb-1.5">Offline SOS Protocol</h4>
                <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                  Past Dirang, past base camp, past the last cell tower — your phone still has GPS.
                  Aaraksha grabs your satellite coordinates and drops to a structured SMS the moment
                  it detects no connectivity, reaching authorities without a data connection.
                </p>
              </div>
              <div className="flex md:justify-end">
                <SignalDropCard />
              </div>
            </div>

            {/* DMS */}
            <div className="py-7 grid md:grid-cols-2 gap-6 items-center">
              <div className="md:order-2">
                <Timer className="w-7 h-7 text-primary mb-3" />
                <h4 className="text-xl font-bold text-on-surface mb-1.5">Dead Man's Switch</h4>
                <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                  Set a check-in interval before you head into low-connectivity terrain. Miss it,
                  and your emergency contacts and the nearest rescuer — official team or verified
                  local volunteer — get your last known location automatically, no manual SOS needed.
                </p>
              </div>
              <div className="md:order-1 flex md:justify-start">
                <DMSDial />
              </div>
            </div>

            {/* Live Rescuer Tracking */}
            <div className="py-7 grid md:grid-cols-2 gap-6 items-center">
              <div>
                <Navigation className="w-7 h-7 text-primary mb-3" />
                <h4 className="text-xl font-bold text-on-surface mb-1.5">Live Rescuer Tracking</h4>
                <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                  Whoever's closest gets sent — an official rescue team or a govt-verified local
                  volunteer, whichever can reach you faster. Once assigned, you and your family
                  watch them close the distance on a live map with a real road route, not a
                  straight line.
                </p>
              </div>
              <div className="flex md:justify-end">
                <RescuerRouteCard />
              </div>
            </div>

            {/* TSI */}
            <div className="py-7 grid md:grid-cols-2 gap-6 items-center">
              <div className="md:order-2">
                <BarChart3 className="w-7 h-7 text-primary mb-3" />
                <h4 className="text-xl font-bold text-on-surface mb-1.5">Travel Safety Index</h4>
                <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                  A 0–100 score per destination, recalculated hourly from live weather and terrain
                  data, cross-checked against a real trained risk model — not fixed rules — with
                  its top contributing factors always shown. The same score district authorities
                  see on the command center map.
                </p>
              </div>
              <div className="md:order-1 flex md:justify-start">
                <TSIBarChart />
              </div>
            </div>

            {/* Guides */}
            <div className="py-7 grid md:grid-cols-2 gap-6 items-center">
              <div>
                <MapPinned className="w-7 h-7 text-on-surface mb-3" />
                <h4 className="text-xl font-bold text-on-surface mb-1.5">Contextual Safety Guides</h4>
                <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                  Your GPS coordinates resolve to the nearest hospital, police post, and rescue team —
                  distances and phone numbers included — cached for the exact moment you lose signal.
                </p>
              </div>
              <div className="flex md:justify-end">
                <div className="relative rounded-2xl bg-surface-container-lowest border border-outline-variant p-4 w-72 shadow-sm">
                  <div className="mb-2">
                    <div className="inline-flex items-center gap-1.5 bg-slate-900 rounded-full pl-2 pr-2.5 py-1">
                      <WifiOff className="w-3 h-3 text-white/70" />
                      <span className="text-[9px] font-extrabold uppercase tracking-wide text-white/90">Cached · no signal</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-9 h-9 rounded-full bg-sos/10 flex items-center justify-center flex-shrink-0">
                      <Plus className="w-4 h-4 text-sos" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-on-surface truncate">Tawang District Hospital</p>
                      <p className="text-[10px] text-on-surface-variant">Nearest hospital</p>
                    </div>
                    <span className="text-[11px] font-bold text-on-surface-variant flex-shrink-0">4.0 km</span>
                  </div>
                  <div className="h-px bg-outline-variant" />
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-9 h-9 rounded-full bg-trust/10 flex items-center justify-center flex-shrink-0">
                      <Siren className="w-4 h-4 text-trust" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-on-surface truncate">Tawang Mountain Rescue</p>
                      <p className="text-[10px] text-on-surface-variant">Nearest rescue unit</p>
                    </div>
                    <span className="text-[11px] font-bold text-safe flex-shrink-0">On call</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How It Works — connected by the same trail motif ────────── */}
        <section id="steps" className="py-14 md:py-20 scroll-mt-20 max-w-6xl mx-auto px-5 md:px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-black text-on-surface mb-3">Your safety net, activated in 3 steps</h2>
            <p className="text-on-surface-variant">Set up once — Aaraksha watches over you for the entire journey.</p>
          </div>
          <div className="relative">
            <svg viewBox="0 0 800 20" className="absolute top-6 left-0 w-full h-5 hidden md:block" preserveAspectRatio="none" aria-hidden="true">
              <line x1="140" y1="10" x2="660" y2="10" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="1 8" strokeLinecap="round" />
            </svg>
            <div className="grid md:grid-cols-3 gap-8 relative">
              {[
                { step: '01', icon: ClipboardList, title: 'Plan Your Trip', desc: 'Build your itinerary. Get a Travel Safety Index score. AI generates your packing list.' },
                { step: '02', icon: ShieldCheck, title: 'Activate Safety', desc: "Set your Dead Man's Switch interval. Share your Guardian link with family." },
                { step: '03', icon: FlagTriangleRight, title: 'Travel with Confidence', desc: 'If anything goes wrong — one tap sends SOS, even without internet.' },
              ].map(({ step, icon: Icon, title, desc }) => (
                <div key={step} className="relative text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-surface-container-lowest border-2 border-primary flex items-center justify-center mb-4 shadow-sm relative z-10">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-display text-xs font-black text-on-surface-variant/50 uppercase tracking-widest mb-1">Step {step}</span>
                  <h3 className="text-lg font-bold text-on-surface mb-2">{title}</h3>
                  <p className="text-on-surface-variant text-sm max-w-[240px]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Basecamp readiness (light-theme stat strip, not a dark slab) ── */}
        <section className="py-10 md:py-14 max-w-6xl mx-auto px-5 md:px-6">
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 md:p-10 relative overflow-hidden">
            <ContourLines className="absolute inset-x-0 bottom-0 w-full h-24 opacity-40 -z-0" />
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { num: '10+', label: 'NER Destinations Tracked' },
                { num: '4', label: 'Portals — Tourist · Govt · Guardian · Rescuer' },
                { num: '2G', label: 'Offline SOS Capable' },
                { num: 'SHA-256', label: 'Verifiable Journey Passport' },
              ].map(({ num, label }) => (
                <div key={label}>
                  <p className="font-display text-4xl font-black text-on-surface mb-1">{num}</p>
                  <p className="text-sm text-on-surface-variant">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer CTA ────────────────────────────────────────────── */}
        <section className="py-16 text-center px-5">
          <CheckCircle2 className="w-8 h-8 text-safe mx-auto mb-4" />
          <h2 className="font-display text-3xl font-black text-on-surface mb-3">Ready to travel safe?</h2>
          <p className="text-on-surface-variant mb-8">Register with your Government ID and start your safe journey today.</p>
          <Button
            onClick={() => navigate('/auth?tab=register')}
            className="bg-primary text-primary-foreground font-semibold rounded-full h-14 px-10 text-base shadow-glass"
          >
            Register Now — It's Free <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </section>

        <footer className="border-t border-outline-variant py-8 text-center text-sm text-on-surface-variant flex items-center justify-center gap-2 max-w-6xl mx-auto px-5">
          <Users className="w-4 h-4" />
          Aaraksha © 2025 · SIH 2025 · Smart Tourism · Safe Journey · Northeast India
        </footer>
      </main>
    </div>
  )
}
