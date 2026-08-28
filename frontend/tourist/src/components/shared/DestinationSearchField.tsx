// src/components/shared/DestinationSearchField.tsx
// Type-ahead place search (city + state input pair replacement) that
// actually captures lat/lng — used wherever a trip stop is added, so every
// stop can appear on the itinerary map instead of silently being dropped
// (TripDetailPage's map tab filters out stops with no coordinates).
import { useEffect, useRef, useState } from 'react'
import { MapPin, Loader2, Search } from 'lucide-react'
import { searchPlaces, type GeocodeResult } from '../../lib/geocode'
import { cn } from '../../lib/utils'

interface DestinationSearchFieldProps {
  city: string
  onCityChange: (city: string) => void
  onSelect: (result: GeocodeResult) => void
  cityPlaceholder?: string
  className?: string
}

const DEBOUNCE_MS = 300

export function DestinationSearchField({ city, onCityChange, onSelect, cityPlaceholder, className }: DestinationSearchFieldProps) {
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (city.trim().length < 3) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => {
      searchPlaces(city).then((r) => { setResults(r); setLoading(false); setActiveIdx(-1) })
    }, DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const pick = (result: GeocodeResult) => {
    onSelect(result)
    setOpen(false)
    setResults([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(results[activeIdx]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={city}
          onChange={(e) => { onCityChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={cityPlaceholder}
          className="w-full h-10 rounded-lg text-sm bg-surface-container border border-outline-variant pl-8 pr-8 transition-colors focus:outline-none focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 text-on-surface-variant absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={`${r.lat}-${r.lng}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(r)}
              className={cn('w-full flex items-start gap-2 px-3 py-2 text-left text-xs transition-colors',
                i === activeIdx ? 'bg-primary/10' : 'hover:bg-surface-container')}
            >
              <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="block font-semibold text-on-surface truncate">{r.city}{r.state ? `, ${r.state}` : ''}</span>
                <span className="block text-on-surface-variant truncate">{r.label}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
