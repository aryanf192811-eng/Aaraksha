// src/pages/NotFoundPage.tsx
import { Shield, Link2Off } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-container-lowest px-6 text-center font-sans">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-md border border-outline-variant p-8">
        <div className="w-16 h-16 rounded-2xl bg-warning/15 flex items-center justify-center mx-auto mb-5">
          <Link2Off className="w-8 h-8 text-warning" />
        </div>
        <h1 className="font-display text-xl font-black text-on-surface mb-2">Tracking link not found</h1>
        <p className="text-sm text-on-surface-variant leading-relaxed">Ask the traveler to share a valid Guardian tracking link.</p>
      </div>
      <div className="flex items-center gap-2 mt-8">
        <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm text-on-surface-variant">Aaraksha · Smart Tourism · Safe Journey</span>
      </div>
    </div>
  )
}
