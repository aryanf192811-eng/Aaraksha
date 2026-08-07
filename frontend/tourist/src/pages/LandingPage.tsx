// src/pages/LandingPage.tsx
// Design: Stitch "Aaraksha Landing Page" — radial-gradient hero, glass TSI
// card, bento-grid feature layout, Inter 900 display type. Icons stay
// lucide-react (visual equivalent of the design's Material Symbols set).
import { useNavigate } from 'react-router-dom'
import {
  Shield, ShieldCheck, Map, ArrowRight, Play, Users,
  Radio, Siren, Timer, BarChart3, BookOpen, Sparkles,
  ClipboardList, WifiOff,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAuthStore } from '../store/auth.store'
import { getDestinationImage } from '../lib/destinationImages'

const GOVT_PORTAL_URL = import.meta.env.VITE_GOVT_PORTAL_URL || 'http://localhost:5174'

const SPOTLIGHT_STOPS = ['Kaziranga', 'Tawang', 'Cherrapunji']

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
            <a className="text-xs font-extrabold uppercase tracking-wider text-primary hover:bg-surface-container/70 transition-colors px-4 py-2 rounded-full" href="#features">Features</a>
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

      <main className="pt-[80px] pb-24 md:pb-16 max-w-6xl mx-auto px-5 md:px-6">
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="py-10 md:py-20 flex flex-col md:flex-row items-center gap-10 md:gap-16 relative isolate">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-surface to-surface opacity-80 rounded-3xl" />

          <div className="w-full md:w-1/2 flex flex-col gap-6 items-start">
            <div className="inline-flex items-center gap-1.5 bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant">
              <span className="w-2 h-2 rounded-full bg-safe animate-pulse" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant">Live Protection Active</span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl md:text-[3.4rem] font-black text-on-surface leading-[1.05] tracking-tight">
              Plan Smart. <br /><span className="text-primary">Travel Safe.</span>
            </h2>
            <p className="text-base text-on-surface-variant max-w-md leading-relaxed">
              India's first tourism platform that treats your safety as a first-class feature.
              Access offline SOS, monitor real-time risk levels, and stay protected — even without signal.
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

          {/* Visual: TSI mock card + glass floating badge */}
          <div className="w-full md:w-1/2 relative">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-outline-variant relative bg-gradient-to-br from-primary/15 via-surface-container to-surface flex items-center justify-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-container-high" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray="264" strokeDashoffset="71" className="text-tsi-low transition-all duration-700" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-4xl font-black text-on-surface">92</span>
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">Safety Score</span>
                </div>
              </div>
              {/* Glassmorphic floating card */}
              <div className="absolute -bottom-4 -left-4 glass-card p-3.5 rounded-xl flex items-center gap-3 shadow-lg">
                <div className="w-11 h-11 rounded-full bg-tsi-low/15 flex items-center justify-center border-2 border-tsi-low flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-tsi-low" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-on-surface">Current Location</p>
                  <p className="text-[11px] text-on-surface-variant">High Safety Score</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Bento Feature Grid ───────────────────────────────────── */}
        <section id="features" className="py-14 md:py-20 scroll-mt-20">
          <div className="text-center mb-10">
            <h3 className="font-display text-3xl font-black text-on-surface mb-2">Comprehensive Safety</h3>
            <p className="text-on-surface-variant">Progressive disclosure of critical tools when you need them most.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Offline SOS — spans 2 */}
            <div className="md:col-span-2 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm hover:shadow-lg transition-shadow group flex flex-col justify-between overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sos-light rounded-bl-full opacity-40 -z-0 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <Radio className="w-8 h-8 text-sos mb-3" />
                <h4 className="text-lg font-bold text-on-surface mb-1">Offline SOS Protocol</h4>
                <p className="text-sm text-on-surface-variant max-w-sm">
                  When connectivity drops, Aaraksha automatically switches to encrypted SMS fallback, ensuring emergency
                  signals reach local authorities and trusted contacts.
                </p>
              </div>
              <div className="mt-5 relative z-10">
                <span className="inline-flex items-center gap-1.5 bg-sos text-white px-4 py-2 rounded-full text-xs font-extrabold uppercase tracking-wide shadow-md">
                  <Siren className="w-4 h-4" /> Emergency Ready
                </span>
              </div>
            </div>
            {/* Dead Man's Switch */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm hover:shadow-lg transition-shadow flex flex-col justify-between">
              <div>
                <Timer className="w-8 h-8 text-primary mb-3" />
                <h4 className="text-lg font-bold text-on-surface mb-1">Dead Man's Switch</h4>
                <p className="text-sm text-on-surface-variant">
                  Set automated check-ins. If missed, alerts broadcast instantly to your emergency network with your last known location.
                </p>
              </div>
              <div className="mt-5">
                <span className="font-mono text-xs font-bold text-on-surface-variant bg-surface-container px-2.5 py-1.5 rounded">Next: 04:20:00</span>
              </div>
            </div>
            {/* TSI */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm hover:shadow-lg transition-shadow">
              <BarChart3 className="w-8 h-8 text-primary mb-3" />
              <h4 className="text-lg font-bold text-on-surface mb-1">Travel Safety Index</h4>
              <p className="text-sm text-on-surface-variant mb-4">
                Real-time risk assessment powered by weather data and local government advisories.
              </p>
              <div className="flex gap-1">
                <div className="h-2 flex-1 rounded-full bg-tsi-low" />
                <div className="h-2 flex-1 rounded-full bg-surface-container-high" />
                <div className="h-2 flex-1 rounded-full bg-surface-container-high" />
                <div className="h-2 flex-1 rounded-full bg-surface-container-high" />
              </div>
            </div>
            {/* Guides — spans 2 */}
            <div className="md:col-span-2 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant shadow-sm hover:shadow-lg transition-shadow flex items-center gap-6">
              <div className="flex-1">
                <BookOpen className="w-8 h-8 text-on-surface mb-3" />
                <h4 className="text-lg font-bold text-on-surface mb-1">Contextual Safety Guides</h4>
                <p className="text-sm text-on-surface-variant">
                  Instantly access local emergency numbers, cultural protocols, and localized safety tips based on your GPS coordinates.
                </p>
              </div>
              <div className="hidden md:flex w-28 h-28 bg-surface-container rounded-2xl border border-outline-variant items-center justify-center flex-shrink-0">
                <WifiOff className="w-10 h-10 text-on-surface-variant" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Destination spotlight ────────────────────────────────── */}
        <section className="py-10 md:py-16">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-xs font-extrabold text-primary uppercase tracking-widest mb-1.5">Where you're headed</p>
              <h2 className="font-display text-2xl md:text-3xl font-black text-on-surface">Northeast India, safely explored</h2>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {SPOTLIGHT_STOPS.map((city) => (
              <div key={city}
                className="group relative rounded-2xl overflow-hidden aspect-[4/5] shadow-sm hover:shadow-lg transition-shadow cursor-pointer border border-outline-variant"
                onClick={() => navigate('/auth?tab=register')}>
                <img src={getDestinationImage(city, { w: 700 })} alt={city}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute top-3 right-3 glass-card px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-secondary" />
                  <span className="text-[10px] font-extrabold text-on-surface">TSI tracked</span>
                </div>
                <div className="absolute bottom-0 inset-x-0 p-4">
                  <p className="font-display text-lg font-black text-white">{city}</p>
                  <p className="text-xs text-white/70 font-medium">Live weather-aware risk score</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How It Works ─────────────────────────────────────────── */}
        <section id="steps" className="py-14 md:py-20 text-center scroll-mt-20">
          <h2 className="font-display text-3xl font-black text-on-surface mb-3">Your safety net, activated in 3 steps</h2>
          <p className="text-on-surface-variant mb-12">Set up once — Aaraksha watches over you for the entire journey.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: ClipboardList, title: 'Plan Your Trip', desc: 'Build your itinerary. Get a Travel Safety Index score. AI generates your packing list.' },
              { step: '02', icon: ShieldCheck, title: 'Activate Safety', desc: "Set your Dead Man's Switch interval. Share Guardian link with family." },
              { step: '03', icon: Siren, title: 'Travel with Confidence', desc: 'If anything goes wrong — one tap sends SOS even without internet.' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="relative">
                <div className="font-display text-6xl font-black text-surface-container-high mb-2">{step}</div>
                <Icon className="w-8 h-8 text-primary mb-3 mx-auto" />
                <h3 className="text-lg font-bold text-on-surface mb-2">{title}</h3>
                <p className="text-on-surface-variant text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <section className="relative py-16 my-4 rounded-2xl overflow-hidden bg-slate-900">
          <div className="relative max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { num: '10+', label: 'NER Destinations' },
              { num: '3', label: 'Portals — Tourist · Govt · Guardian' },
              { num: '2G', label: 'Offline SOS Capable' },
              { num: '24/7', label: 'Rescue Readiness' },
            ].map(({ num, label }) => (
              <div key={label}>
                <p className="font-display text-4xl font-black text-white mb-1">{num}</p>
                <p className="text-sm text-white/70">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer CTA ────────────────────────────────────────────── */}
        <section className="py-16 text-center">
          <h2 className="font-display text-3xl font-black text-on-surface mb-3">Ready to travel safe?</h2>
          <p className="text-on-surface-variant mb-8">Register with your Government ID and start your safe journey today.</p>
          <Button
            onClick={() => navigate('/auth?tab=register')}
            className="bg-primary text-primary-foreground font-extrabold rounded-full h-14 px-10 text-sm uppercase tracking-wide shadow-lg"
          >
            Register Now — It's Free <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </section>

        <footer className="border-t border-outline-variant py-8 text-center text-sm text-on-surface-variant flex items-center justify-center gap-2">
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
