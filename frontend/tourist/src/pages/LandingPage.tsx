// src/pages/LandingPage.tsx
// Design concept: "Terrain profile" — Northeast India's identity is its
// elevation change (Brahmaputra floodplain to 3000m+ passes), and that's
// also literally what TSI measures per-destination (altitude_m, zone_type,
// difficulty). A layered contour/ridgeline motif carries the page instead
// of the generic radial-gradient hero + icon-bento-grid template, and the
// destination strip below uses real seeded data (altitude, zone, ILP)
// rather than filler copy.
import { useNavigate } from 'react-router-dom'
import {
  Shield, ShieldCheck, Map, ArrowRight, Play, Users,
  Radio, Siren, Timer, BarChart3, WifiOff, MessageSquareWarning,
  Satellite, MapPinned, ClipboardList, CheckCircle2, FlagTriangleRight,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAuthStore } from '../store/auth.store'
import { getDestinationImage } from '../lib/destinationImages'

const GOVT_PORTAL_URL = import.meta.env.VITE_GOVT_PORTAL_URL || 'http://localhost:5174'

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

// Layered ridgeline + dotted trail + summit flag — the hero's visual thesis:
// a route climbing through exactly the kind of terrain TSI is scoring.
function TerrainPeak() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="ridgeBack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde9c8" />
          <stop offset="100%" stopColor="#fbf4e4" />
        </linearGradient>
        <linearGradient id="ridgeFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9dfc9" />
          <stop offset="100%" stopColor="#eef4ea" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="400" height="300" fill="#fffdf8" />
      {/* back range */}
      <path d="M0,190 L55,125 L105,165 L165,95 L225,155 L285,110 L340,155 L400,135 L400,300 L0,300 Z" fill="url(#ridgeBack)" />
      {/* front range */}
      <path d="M0,245 L50,195 L100,225 L152,172 L205,218 L262,182 L322,228 L400,205 L400,300 L0,300 Z" fill="url(#ridgeFront)" />
      {/* trail, dotted, climbing to the front-range summit at 152,172 */}
      <path d="M42,272 Q95,255 118,222 T152,172" fill="none" stroke="#b45309" strokeWidth="2.5" strokeDasharray="1 8" strokeLinecap="round" />
      {[[42, 272], [80, 248], [118, 222], [152, 172]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i === 3 ? 5 : 3} fill={i === 3 ? '#f59e0b' : '#b45309'} />
      ))}
      {/* summit flag */}
      <g transform="translate(152, 172)">
        <line x1="0" y1="0" x2="0" y2="-26" stroke="#0f172a" strokeWidth="2" />
        <path d="M0,-26 L18,-20 L0,-14 Z" fill="#f59e0b" />
      </g>
    </svg>
  )
}

// A single icon-flow diagram: reused for each mechanism explainer row so
// the product's actual behavior is shown as a sequence, not summarized in
// a paragraph next to a decorative icon.
function FlowDiagram({ steps }: { steps: { icon: React.ElementType; label: string }[] }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-11 h-11 rounded-xl bg-surface-container-lowest border border-outline-variant flex items-center justify-center shadow-sm">
              <s.icon className="w-5 h-5 text-on-surface" />
            </div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide text-center leading-tight w-16">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <svg width="28" height="10" viewBox="0 0 28 10" className="mb-4 flex-shrink-0" aria-hidden="true">
              <line x1="0" y1="5" x2="20" y2="5" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="1 4" strokeLinecap="round" />
              <path d="M18,1 L24,5 L18,9" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      ))}
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans antialiased">
      {/* ── TopAppBar ─────────────────────────────────────────────── */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md shadow-sm">
        <div className="flex justify-between items-center px-5 py-2.5 w-full max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="font-display text-xl font-black text-primary tracking-tight">Aaraksha</h1>
          </div>
          <nav className="hidden md:flex gap-2 items-center">
            <a className="text-xs font-extrabold uppercase tracking-wider text-primary hover:bg-surface-container/70 transition-colors px-4 py-2 rounded-full" href="#terrain">Terrain</a>
            <a className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container/70 transition-colors px-4 py-2 rounded-full" href="#features">Features</a>
            <a className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container/70 transition-colors px-4 py-2 rounded-full" href="#steps">How it Works</a>
          </nav>
          {isAuthenticated ? (
            <Button onClick={() => navigate('/dashboard')}
              className="bg-primary text-primary-foreground rounded-full px-6 font-extrabold text-xs uppercase tracking-wider">
              Dashboard
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => navigate('/auth')} className="hidden sm:inline-flex text-on-surface-variant">Log In</Button>
              <Button onClick={() => navigate('/auth?tab=register')}
                className="bg-primary text-primary-foreground px-6 rounded-full font-extrabold text-xs uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-95 transition-all">
                Get Started
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="pt-[80px] pb-24 md:pb-16">
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden isolate">
          <ContourLines className="absolute inset-x-0 top-0 w-full h-[260px] -z-10 opacity-70" />
          <div className="max-w-6xl mx-auto px-5 md:px-6 py-10 md:py-20 flex flex-col md:flex-row items-center gap-10 md:gap-16">
            <div className="w-full md:w-1/2 flex flex-col gap-6 items-start">
              <div className="inline-flex items-center gap-1.5 bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant">
                <span className="w-2 h-2 rounded-full bg-safe animate-pulse" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant">Live Protection Active</span>
              </div>
              <h2 className="font-display text-4xl sm:text-5xl md:text-[3.4rem] font-black text-on-surface leading-[1.05] tracking-tight">
                Every valley,<br />pass, and river island<br /><span className="text-primary">scored before you go.</span>
              </h2>
              <p className="text-base text-on-surface-variant max-w-md leading-relaxed">
                Northeast India ranges from Brahmaputra floodplains to 3000m Himalayan passes.
                Aaraksha tracks the terrain you're actually entering — weather, connectivity,
                altitude, permits — and keeps working even where the signal doesn't.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button onClick={() => navigate('/auth?tab=register')}
                  className="bg-primary text-primary-foreground px-8 h-14 rounded-full font-extrabold text-sm uppercase tracking-wide shadow-lg active:scale-95 transition-all">
                  Start Your Safe Journey
                </Button>
                <a href={GOVT_PORTAL_URL} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline"
                    className="bg-surface text-on-surface border-outline-variant px-8 h-14 rounded-full font-extrabold text-sm uppercase tracking-wide active:scale-95 transition-all flex items-center gap-2">
                    <Play className="w-4 h-4" fill="currentColor" /> Government Portal
                  </Button>
                </a>
              </div>
            </div>

            {/* Visual: hand-authored terrain + trail + TSI ring */}
            <div className="w-full md:w-1/2 relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-outline-variant relative">
                <TerrainPeak />
                {/* TSI ring, anchored to the summit flag it's scoring */}
                <div className="absolute top-[26%] left-[30%] glass-card rounded-xl p-3 flex items-center gap-2.5 shadow-lg">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
                      <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="5" className="text-surface-container-high" />
                      <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
                        strokeDasharray="113" strokeDashoffset="30" className="text-tsi-low" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[13px] font-black text-on-surface">73</span>
                    </div>
                  </div>
                  <div className="pr-1">
                    <p className="text-[11px] font-extrabold text-on-surface leading-tight">Dzukou Valley</p>
                    <p className="text-[10px] text-on-surface-variant leading-tight">2452m · TSI updated hourly</p>
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 glass-card px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <Satellite className="w-3.5 h-3.5 text-on-surface" />
                  <span className="text-[10px] font-extrabold text-on-surface">Works offline</span>
                </div>
              </div>
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
                <img src={getDestinationImage(stop.city, { w: 700 })} alt={stop.city}
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
            <p className="text-on-surface-variant max-w-lg">Four mechanisms, shown as they run — not just named.</p>
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
                <FlowDiagram steps={[
                  { icon: WifiOff, label: 'No Signal' },
                  { icon: MessageSquareWarning, label: 'SMS Relay' },
                  { icon: Siren, label: 'Rescue Alerted' },
                ]} />
              </div>
            </div>

            {/* DMS */}
            <div className="py-7 grid md:grid-cols-2 gap-6 items-center">
              <div className="md:order-2">
                <Timer className="w-7 h-7 text-primary mb-3" />
                <h4 className="text-xl font-bold text-on-surface mb-1.5">Dead Man's Switch</h4>
                <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                  Set a check-in interval before you head into low-connectivity terrain. Miss it, and
                  your emergency contacts and the nearest govt response unit get your last known
                  location automatically — no manual SOS needed.
                </p>
              </div>
              <div className="md:order-1 flex md:justify-start">
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" className="text-surface-container-high" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray="264" strokeDashoffset="190" className="text-primary" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-sm font-black text-on-surface">04:20</span>
                    <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wide">to check-in</span>
                  </div>
                </div>
              </div>
            </div>

            {/* TSI */}
            <div className="py-7 grid md:grid-cols-2 gap-6 items-center">
              <div>
                <BarChart3 className="w-7 h-7 text-primary mb-3" />
                <h4 className="text-xl font-bold text-on-surface mb-1.5">Travel Safety Index</h4>
                <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                  A 0–100 score per destination, recalculated hourly from live weather, terrain
                  difficulty, connectivity, and standing government advisories — the same score
                  shown to district authorities on the command center map.
                </p>
              </div>
              <div className="flex md:justify-end items-center gap-3">
                {[
                  { label: 'Kaziranga', score: 91, cls: 'text-tsi-low' },
                  { label: 'Sohra', score: 68, cls: 'text-tsi-moderate' },
                  { label: 'Tawang', score: 44, cls: 'text-tsi-high' },
                ].map(d => (
                  <div key={d.label} className="flex flex-col items-center gap-1.5">
                    <div className="relative w-16 h-16">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-container-high" />
                        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
                          strokeDasharray="264" strokeDashoffset={264 - (264 * d.score) / 100} className={d.cls} />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-black text-on-surface">{d.score}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Guides */}
            <div className="py-7 grid md:grid-cols-2 gap-6 items-center">
              <div className="md:order-2">
                <MapPinned className="w-7 h-7 text-on-surface mb-3" />
                <h4 className="text-xl font-bold text-on-surface mb-1.5">Contextual Safety Guides</h4>
                <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
                  Your GPS coordinates resolve to the nearest hospital, police post, and rescue team —
                  distances and phone numbers included — cached for the exact moment you lose signal.
                </p>
              </div>
              <div className="md:order-1 flex md:justify-start">
                <div className="glass-card rounded-xl p-4 w-64 shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <WifiOff className="w-3.5 h-3.5 text-on-surface-variant" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-on-surface-variant">Cached · No signal</span>
                  </div>
                  <p className="text-xs font-bold text-on-surface mb-0.5">Nearest hospital</p>
                  <p className="text-[11px] text-on-surface-variant">Tawang District Hospital · 4.0 km</p>
                  <div className="h-px bg-outline-variant my-2.5" />
                  <p className="text-xs font-bold text-on-surface mb-0.5">Nearest rescue unit</p>
                  <p className="text-[11px] text-on-surface-variant">Tawang Mountain Rescue · on call</p>
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
                { num: '3', label: 'Portals — Tourist · Govt · Guardian' },
                { num: '2G', label: 'Offline SOS Capable' },
                { num: '24/7', label: 'Rescue Readiness' },
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
            className="bg-primary text-primary-foreground font-extrabold rounded-full h-14 px-10 text-sm uppercase tracking-wide shadow-lg"
          >
            Register Now — It's Free <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </section>

        <footer className="border-t border-outline-variant py-8 text-center text-sm text-on-surface-variant flex items-center justify-center gap-2 max-w-6xl mx-auto px-5">
          <Users className="w-4 h-4" />
          Aaraksha © 2025 · SIH 2025 · Smart Tourism · Safe Journey · Northeast India
        </footer>
      </main>

      {/* ── BottomNavBar (mobile) ─────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 rounded-t-2xl bg-surface border-t border-outline-variant shadow-lg">
        <div className="flex justify-around items-center px-2 py-2.5 w-full pb-safe">
          <button onClick={() => navigate('/')} className="flex flex-col items-center justify-center bg-primary text-primary-foreground rounded-full px-4 py-1.5">
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wide mt-1">Home</span>
          </button>
          <button onClick={() => navigate(isAuthenticated ? '/trips' : '/auth')} className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1.5">
            <Map className="w-5 h-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wide mt-1">Trips</span>
          </button>
          <button onClick={() => navigate(isAuthenticated ? '/checkin' : '/auth')} className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1.5">
            <WifiOff className="w-5 h-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wide mt-1">Check-In</span>
          </button>
          <button onClick={() => navigate(isAuthenticated ? '/profile' : '/auth')} className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1.5">
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-extrabold uppercase tracking-wide mt-1">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
