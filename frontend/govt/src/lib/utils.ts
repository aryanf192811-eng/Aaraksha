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

// TSI color utility — returns Tailwind classes based on score
export function getTSIColors(score: number | null): { bg: string; text: string; border: string; label: string } {
  if (score === null) return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', label: 'Not calculated' }
  if (score >= 80) return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'Low Risk' }
  if (score >= 60) return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Moderate Risk' }
  if (score >= 40) return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'High Risk' }
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Extreme Risk' }
}

// Zone type color
export function getZoneColor(zoneType: string): string {
  const map: Record<string, string> = {
    SAFE: 'text-green-600', CAUTION: 'text-amber-600',
    HIGH_RISK: 'text-orange-600', RESTRICTED: 'text-red-600', ILP_REQUIRED: 'text-purple-600',
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

// Download blob as PDF.
// Two bugs fixed here: (1) revokeObjectURL was called synchronously right
// after click() — a.click() schedules the download asynchronously, so
// revoking the blob: URL in the same tick can race the browser's actual
// read of it, corrupting the download (Chrome then shows it with a random
// UUID name and a "file type unrecognized" lock icon instead of the real
// filename/PDF icon). (2) the blob wasn't re-tagged with an explicit
// application/pdf MIME type, so if the axios response's Content-Type ever
// came through empty/wrong, the browser had nothing to identify it by.
export function downloadPDF(blob: Blob, filename: string) {
  const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
  const url = URL.createObjectURL(pdfBlob)
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  
  // Clean up asynchronously to ensure the browser has time to register the download name
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 10000)
}
