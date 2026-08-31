// src/components/shared/NavSOSButton.tsx
// The bottom nav's raised center action — SOS is reachable from anywhere in
// the app now, not just the Dashboard. Owns the exact same two-stage hold
// logic (66% release = quick-send default category, 100% hold = inline
// category picker) that used to live inside DashboardPage's SafetyStrip;
// moved here unchanged so every existing behavior is preserved, just
// globally accessible via AppLayout's persistent <BottomNav/>.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { SOSButton } from './SOSButton'
import { SOSHoldOverlay } from './SOSHoldOverlay'
import { useSafetyStore } from '../../store/safety.store'
import { useSOS } from '../../hooks/useSOS'
import { SOS_SPECIFIC_CATEGORIES, DEFAULT_SOS_CATEGORY } from '../../constants/sosCategories'
import { tEnum } from '../../lib/i18nEnums'
import { cn } from '../../lib/utils'

export function NavSOSButton() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const activeSOSId = useSafetyStore((s) => s.activeSOSId)
  const { sendSOS, sending } = useSOS()
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  // Drives the large overlay below — the nav button is only 64px, so the
  // hold percentage rendered inside it is physically covered by the
  // holding thumb. This is the same live 0–100 value SOSButton already
  // computes every animation frame, just also surfaced up here.
  const [holdProgress, setHoldProgress] = useState(0)

  const handleQuickSend = () => {
    sendSOS(DEFAULT_SOS_CATEGORY).then(() => navigate('/sos')).catch(() => {})
  }
  const handleCategoryPick = (category: typeof DEFAULT_SOS_CATEGORY) => {
    setShowCategoryPicker(false)
    sendSOS(category).then(() => navigate('/sos')).catch(() => {})
  }

  return (
    <>
      <div className="absolute left-1/2 -translate-x-1/2 -top-4 flex flex-col items-center">
        {/* A raised FAB reads as premium when it looks like it's rising out
            of the bar, not just floating above it — the collar (a plain
            surface-colored disc, slightly larger than the button, sitting
            behind it) gives that "mound" the button emerges from, same
            language as Uber/food-delivery apps' central action button. Kept
            deliberately close to the bar (a small lift, not a tall float) —
            "SOS" is written on the button itself now, so there's no
            separate caption underneath pulling it further up. */}
        <div className="relative">
          <span className="absolute -inset-[9px] rounded-full bg-surface shadow-[0_2px_8px_rgba(15,23,42,0.08),0_8px_20px_rgba(15,23,42,0.1)]" />
          <SOSButton
            onTrigger={() => navigate('/sos')}
            isActive={!!activeSOSId}
            size="nav"
            loading={sending}
            twoStage
            onQuickSend={handleQuickSend}
            onHoldComplete={() => setShowCategoryPicker(true)}
            onHoldProgress={setHoldProgress}
            className="relative shadow-[0_2px_6px_rgba(220,38,38,0.3),0_10px_20px_-4px_rgba(220,38,38,0.35)] rounded-full"
          />
        </div>
      </div>

      <SOSHoldOverlay progress={holdProgress} armed={holdProgress >= 66} />

      {/* Inline category picker — reached by holding the nav SOS button all
          the way to 100% instead of releasing at the 66% quick-send point. */}
      {showCategoryPicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={() => setShowCategoryPicker(false)}>
          <div className="bg-surface-container-lowest rounded-t-3xl w-full p-6 pb-10 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display text-lg font-black text-on-surface">{t('dashboard.categoryPickerTitle')}</h2>
              <button onClick={() => setShowCategoryPicker(false)} aria-label={t('common.cancel')}>
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>
            <p className="text-sm text-on-surface-variant mb-5">{t('dashboard.categoryPickerSubtitle')}</p>
            <div className="grid grid-cols-3 gap-2.5">
              {SOS_SPECIFIC_CATEGORIES.map(({ value, Icon, color }) => (
                <button key={value} type="button" onClick={() => handleCategoryPick(value)}
                  className="bg-surface-container rounded-2xl p-3.5 flex flex-col items-center gap-2 active:scale-95 transition-transform">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', color)}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-xs font-bold text-on-surface text-center leading-tight">{tEnum(t, 'sosCategory', value)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
