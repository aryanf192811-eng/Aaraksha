// src/pages/NotFoundPage.tsx
import { Link2Off } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-6 text-center font-sans">
      <Link2Off className="w-12 h-12 text-on-surface-variant mb-4" />
      <h1 className="font-display text-xl font-black text-on-surface mb-2">Tracking link not found</h1>
      <p className="text-sm text-on-surface-variant">Ask the traveler to share a valid Guardian tracking link.</p>
    </div>
  )
}
