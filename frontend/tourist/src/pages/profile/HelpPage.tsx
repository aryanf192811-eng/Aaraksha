// src/pages/profile/HelpPage.tsx
// A first-session tourist has two real questions: "how do I get around this
// app" and "what does the safety stuff actually do for me." Both answered
// here in one place — a short icon-guide to the five things reachable from
// anywhere (bottom nav + the profile avatar), then an FAQ covering the
// features a new user wouldn't discover just by tapping around (the SMS
// fallback, the Dead Man's Switch, the Guardian link, the Rescue
// Verification Code). Reachable from the Dashboard header's "?" icon and
// from Profile — both places a lost user is likely already looking.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Home, Map, Siren, MapPin, Globe, User, ChevronDown,
  HelpCircle, Compass,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const NAV_GUIDE = [
  { Icon: Home,  titleKey: 'help.nav.home.title',    descKey: 'help.nav.home.desc' },
  { Icon: Map,   titleKey: 'help.nav.trips.title',   descKey: 'help.nav.trips.desc' },
  { Icon: Siren, titleKey: 'help.nav.sos.title',     descKey: 'help.nav.sos.desc' },
  { Icon: MapPin, titleKey: 'help.nav.checkIn.title', descKey: 'help.nav.checkIn.desc' },
  { Icon: Globe, titleKey: 'help.nav.community.title', descKey: 'help.nav.community.desc' },
  { Icon: User,  titleKey: 'help.nav.profile.title',  descKey: 'help.nav.profile.desc' },
] as const

const FAQ_KEYS = [
  'sendSos', 'afterSos', 'dms', 'noSignal', 'whoSeesLocation', 'guardianLink', 'tsi', 'offline',
] as const

export default function HelpPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [openFaq, setOpenFaq] = useState<string | null>(FAQ_KEYS[0])

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label={t('common.back')}>
            <ArrowLeft className="w-6 h-6 text-on-surface" />
          </button>
          <div>
            <h1 className="text-xl font-black text-on-surface">{t('help.title')}</h1>
            <p className="text-xs text-on-surface-variant">{t('help.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-5 space-y-6">
        {/* ── Getting around the app ──────────────────────────────── */}
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-on-surface uppercase tracking-wide mb-3">
            <Compass className="w-4 h-4 text-primary" /> {t('help.navGuideTitle')}
          </h2>
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm divide-y divide-outline-variant">
            {NAV_GUIDE.map(({ Icon, titleKey, descKey }) => (
              <div key={titleKey} className="flex items-start gap-3 p-4">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-on-surface text-sm">{t(titleKey)}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{t(descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ──────────────────────────────────────────────────── */}
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-on-surface uppercase tracking-wide mb-3">
            <HelpCircle className="w-4 h-4 text-primary" /> {t('help.faqTitle')}
          </h2>
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm divide-y divide-outline-variant overflow-hidden">
            {FAQ_KEYS.map((key) => {
              const isOpen = openFaq === key
              return (
                <div key={key}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : key)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-3 p-4 text-left"
                  >
                    <span className="font-bold text-on-surface text-sm">{t(`help.faq.${key}.q`)}</span>
                    <ChevronDown className={cn('w-4 h-4 text-on-surface-variant flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <p className="px-4 pb-4 text-sm text-on-surface-variant leading-relaxed animate-slide-up">
                      {t(`help.faq.${key}.a`)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-center text-xs text-on-surface-variant pb-4">{t('help.footer')}</p>
      </div>
    </div>
  )
}
