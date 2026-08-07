// src/components/shared/SOSButton.tsx
// The most important UI element in the tourist app — must be unmissable.
import { AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface SOSButtonProps {
  onTrigger: () => void
  isActive?: boolean
  disabled?: boolean
  loading?: boolean
  size?: 'default' | 'compact'
  className?: string
}

export function SOSButton({
  onTrigger, isActive = false, disabled = false, loading = false, size = 'default', className,
}: SOSButtonProps) {
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {/* Pulse rings — active while an SOS is live, and as a standing
          affordance even at rest so the button reads as "always armed". */}
      <span className={cn('absolute inline-flex h-full w-full rounded-full bg-sos animate-pulse-ring',
        isActive ? 'opacity-40' : 'opacity-20')} />
      <span className={cn('absolute inline-flex h-full w-full rounded-full bg-sos animate-pulse-ring-delayed',
        isActive ? 'opacity-30' : 'opacity-10')} />
      <button
        onClick={onTrigger}
        disabled={disabled || loading}
        className={cn(
          'relative z-10 flex flex-col items-center justify-center gap-2',
          'rounded-full font-display font-black tracking-wide shadow-2xl',
          'transition-all duration-200 active:scale-95',
          'focus:outline-none focus:ring-4 focus:ring-red-300 focus:ring-offset-2',
          'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
          size === 'default' ? 'w-44 h-44 text-2xl' : 'w-24 h-24 text-sm',
          isActive
            ? 'bg-red-700 text-white animate-sos-pulse shadow-red-500/50'
            : 'bg-red-500 hover:bg-red-600 text-white shadow-red-400/40',
        )}
        aria-label="Send SOS emergency alert"
      >
        {loading ? (
          <Loader2 className={cn('animate-spin', size === 'default' ? 'w-10 h-10' : 'w-6 h-6')} />
        ) : (
          <>
            <AlertTriangle className={cn(size === 'default' ? 'w-10 h-10' : 'w-6 h-6')} fill="currentColor" />
            <span>{isActive ? 'SOS ACTIVE' : 'SEND SOS'}</span>
            {size === 'default' && <span className="text-xs font-medium opacity-80">Tap to alert</span>}
          </>
        )}
      </button>
    </div>
  )
}
