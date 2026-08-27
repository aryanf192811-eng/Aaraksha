// src/pages/profile/PrivacyPage.tsx
// Digital Personal Data Protection Act, 2023 (DPDP) rights, made real —
// not a privacy-policy paragraph nobody can act on. Every button here
// does exactly what it says: Export downloads a real file, Delete really
// anonymizes the account (unless a genuine open safety/legal record
// requires retention, in which case it says so plainly).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Download, ShieldCheck, ShieldAlert, Trash2, Loader2, Mail, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog'
import dataRightsApi from '../../api/dataRights.api'
import { useAuthStore } from '../../store/auth.store'
import { formatTimeAgo } from '../../lib/utils'

export default function PrivacyPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const logout = useAuthStore(s => s.logout)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const { data: notice, isLoading: loadingNotice } = useQuery({
    queryKey: ['privacy', 'notice'],
    queryFn: () => dataRightsApi.getPrivacyNotice().then(r => r.data.data),
  })

  const { data: requests } = useQuery({
    queryKey: ['privacy', 'deletion-requests'],
    queryFn: () => dataRightsApi.getMyDeletionRequests().then(r => r.data.data),
  })

  const { mutate: requestDeletion, isPending: deleting } = useMutation({
    mutationFn: () => dataRightsApi.requestDeletion(),
    onSuccess: (res) => {
      const result = res.data.data
      if (result.status === 'COMPLETED') {
        toast.success(t('privacy.toastDeleted'), { duration: 6000 })
        setConfirmOpen(false)
        logout()
        navigate('/')
      } else {
        toast.warning(result.reason || t('privacy.toastDeletionDenied'), { duration: 8000 })
        setConfirmOpen(false)
        setConfirmText('')
      }
    },
    onError: () => toast.error(t('privacy.toastDeletionFailed')),
  })

  const latestRequest = (requests || [])[0]

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="bg-surface-container-lowest px-5 pt-12 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6 text-on-surface" /></button>
          <div>
            <h1 className="text-xl font-black text-on-surface">{t('privacy.title')}</h1>
            <p className="text-xs text-on-surface-variant">{t('privacy.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-4 space-y-5">
        {/* What we collect and why */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-on-surface flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4.5 h-4.5 text-primary" /> {t('privacy.whatWeCollect')}
          </h2>
          {loadingNotice && <div className="h-24 bg-surface-container rounded-xl animate-pulse" />}
          <div className="space-y-3">
            {(notice?.categories || []).map((c, i) => (
              <div key={i} className="border-l-2 border-primary/30 pl-3">
                <p className="text-sm font-semibold text-on-surface">{c.data}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{c.purpose}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Your rights */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-on-surface flex items-center gap-2 mb-3">
            <FileText className="w-4.5 h-4.5 text-primary" /> {t('privacy.yourRights')}
          </h2>
          <div className="space-y-3">
            {(notice?.rights || []).map((r, i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-on-surface">{r.right}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{r.how}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-on-surface-variant/70 mt-3 flex items-center gap-1.5">
            <Mail className="w-3 h-3" /> {t('privacy.dpdpNote')}
          </p>
        </div>

        {/* Export */}
        <a href={dataRightsApi.getExportUrl()} target="_blank" rel="noopener noreferrer"
          className="w-full bg-surface-container-lowest rounded-2xl shadow-sm p-5 flex items-center gap-3 text-left hover:shadow-md transition-shadow block">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-on-surface">{t('privacy.exportTitle')}</p>
            <p className="text-xs text-on-surface-variant">{t('privacy.exportDescription')}</p>
          </div>
        </a>

        {/* Deletion status, if any */}
        {latestRequest && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">{t('privacy.lastRequestLabel')}</p>
            <p className="text-sm text-amber-900">
              {latestRequest.status === 'DENIED' ? latestRequest.reason : t('privacy.toastDeleted')}
            </p>
            <p className="text-[11px] text-amber-700/70 mt-1">{formatTimeAgo(latestRequest.requested_at)}</p>
          </div>
        )}

        {/* Delete */}
        <button onClick={() => setConfirmOpen(true)}
          className="w-full bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3 text-left hover:bg-red-100 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-red-700">{t('privacy.deleteTitle')}</p>
            <p className="text-xs text-red-600/80">{t('privacy.deleteDescription')}</p>
          </div>
        </button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => { setConfirmOpen(open); if (!open) setConfirmText('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700"><ShieldAlert className="w-5 h-5" /> {t('privacy.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('privacy.confirmDescription')}</DialogDescription>
          </DialogHeader>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t('privacy.confirmPlaceholder')}
            className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-400"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} className="rounded-full">
              <X className="w-4 h-4 mr-1.5" /> {t('common.cancel')}
            </Button>
            <Button onClick={() => requestDeletion()} disabled={deleting || confirmText.trim().toUpperCase() !== 'DELETE'}
              className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-full">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              {t('privacy.confirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
