// src/pages/NotFoundPage.tsx
import { Link } from 'react-router-dom'
import { MapPinOff } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-6 text-center font-sans">
      <div className="w-16 h-16 rounded-2xl bg-primary/12 flex items-center justify-center mb-5">
        <MapPinOff className="w-8 h-8 text-primary" />
      </div>
      <h1 className="font-display text-xl font-black text-on-surface mb-2">Page not found</h1>
      <Link to="/" className="text-sm text-primary font-semibold">Back to Aaraksha Rescuer</Link>
    </div>
  )
}
