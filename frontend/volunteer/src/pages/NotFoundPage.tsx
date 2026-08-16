// src/pages/NotFoundPage.tsx
import { Link } from 'react-router-dom'
import { MapPinOff } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-6 text-center font-sans">
      <MapPinOff className="w-12 h-12 text-on-surface-variant mb-4" />
      <h1 className="font-display text-xl font-black text-on-surface mb-2">Page not found</h1>
      <Link to="/" className="text-sm text-primary font-semibold">Back to Aaraksha Volunteer</Link>
    </div>
  )
}
