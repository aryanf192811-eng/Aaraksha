// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistance } from 'date-fns'

// Tailwind className merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date formatting
export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'd MMM yyyy')
}
export function formatDateTime(dateStr: string): string {
  return format(new Date(dateStr), 'd MMM yyyy, HH:mm')
}
export function formatTimeAgo(dateStr: string): string {
  return formatDistance(new Date(dateStr), new Date(), { addSuffix: true })
}

// Currency formatting
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

// TSI color utility — returns design-token Tailwind classes based on score
export function getTSIColors(score: number | null): { bg: string; text: string; border: string; label: string } {
  if (score === null) return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', label: 'Not calculated' }
  if (score >= 80) return { bg: 'bg-tsi-low/10', text: 'text-tsi-low', border: 'border-tsi-low/30', label: 'Low Risk' }
  if (score >= 60) return { bg: 'bg-tsi-moderate/10', text: 'text-tsi-moderate', border: 'border-tsi-moderate/30', label: 'Moderate Risk' }
  if (score >= 40) return { bg: 'bg-tsi-high/10', text: 'text-tsi-high', border: 'border-tsi-high/30', label: 'High Risk' }
  return { bg: 'bg-tsi-extreme/10', text: 'text-tsi-extreme', border: 'border-tsi-extreme/30', label: 'Extreme Risk' }
}

// Zone type color
export function getZoneColor(zoneType: string): string {
  const map: Record<string, string> = {
    SAFE: 'text-tsi-low', CAUTION: 'text-primary-dark',
    HIGH_RISK: 'text-tsi-high', RESTRICTED: 'text-sos-dark', ILP_REQUIRED: 'text-purple-600',
  }
  return map[zoneType] || 'text-slate-600'
}

// Format seconds to MM:SS countdown
export function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}:${String(s).padStart(2, '0')}`
}
