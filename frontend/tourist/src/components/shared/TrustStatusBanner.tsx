// src/components/shared/TrustStatusBanner.tsx
// Only ever renders something when restricted -- a healthy trust score is
// invisible, deliberately. The one thing this banner must never, ever
// imply is that the emergency path is affected: restriction gates
// convenience/community features and adds govt scrutiny to a flagged SOS,
// never whether the SOS itself goes through.
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ShieldAlert, Loader2, Send } from 'lucide-react'
import touristApi from '../../api/tourist.api'
import { getErrorMessage } from '../../api/client'

export function TrustStatusBanner() {
  const queryClient = useQueryClient()
  const [showAppealForm, setShowAppealForm] = useState(false)
  const [message, setMessage] = useState('')

  const { data: status } = useQuery({
    queryKey: ['tourist', 'trust-status'],
    queryFn: () => touristApi.getTrustStatus().then((r) => r.data.data),
    staleTime: 60_000,
  })

  const { mutate: submitAppeal, isPending: submitting } = useMutation({
    mutationFn: (msg: string) => touristApi.submitTrustAppeal(msg),
    onSuccess: () => {
      toast.success('Appeal submitted — a district officer will review it')
      setShowAppealForm(false)
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['tourist', 'trust-status'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (!status?.restricted) return null

  return (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-amber-900">Your trust score is low</p>
          {/* Deliberately does not name the specific reason code -- avoids
              teaching a bad-faith account exactly what got flagged and how
              to avoid detection next time, without being cagey about the
              one fact that actually matters to a genuine user. */}
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            You can still always call for help — this never affects SOS. What's limited is community
            posting, and your SOS requests get an extra verification look from government staff.
            Submit an appeal to restore full access.
          </p>
        </div>
      </div>

      {!showAppealForm ? (
        <button
          onClick={() => setShowAppealForm(true)}
          className="mt-3 w-full h-9 rounded-full bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors"
        >
          Submit an appeal
        </button>
      ) : (
        <div className="mt-3 pt-3 border-t border-amber-200">
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Explain your situation — a district officer will review this."
            maxLength={1000}
            className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs resize-none focus:outline-none focus:border-amber-500"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => submitAppeal(message.trim())}
              disabled={submitting || message.trim().length < 20}
              className="flex-1 h-9 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Submit
            </button>
            <button
              onClick={() => setShowAppealForm(false)}
              disabled={submitting}
              className="flex-1 h-9 rounded-full border border-amber-300 text-amber-800 text-xs font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
