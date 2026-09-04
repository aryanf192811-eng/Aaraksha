// src/components/MessageThread.tsx
// Tourist <-> Guardian messaging — always available while this tracking
// link is valid, not gated on an active SOS.
import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Message } from '../types/api.types'
import { cn } from '../lib/utils'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

interface MessageThreadProps {
  messages: Message[] | undefined
  isLoading: boolean
  onSend: (body: string) => void
  sending: boolean
}

export function MessageThread({ messages, isLoading, onSend, sending }: MessageThreadProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages?.length])

  const submit = () => {
    const body = draft.trim()
    if (!body || sending) return
    onSend(body)
    setDraft('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-on-surface-variant">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !messages?.length ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-on-surface-variant px-6">
            <MessageCircle className="w-8 h-8 opacity-40" />
            <p className="text-xs">{t('messages.empty')}</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_kind === 'GUARDIAN'
            return (
              <div key={m.id} className={cn('flex flex-col max-w-[78%]', isMine ? 'items-end ml-auto' : 'items-start mr-auto')}>
                <div className={cn('rounded-2xl px-3.5 py-2 text-sm leading-snug break-words',
                  isMine ? 'bg-primary text-white rounded-br-sm' : 'bg-surface-container text-on-surface rounded-bl-sm')}>
                  {m.body}
                </div>
                <span className="text-[10px] text-on-surface-variant mt-0.5 px-1">
                  {!isMine && `${t(`messages.sender.${m.sender_kind}`)} · `}{formatTime(m.created_at)}
                </span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 border-t border-outline-variant px-3 py-2.5">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            placeholder={t('messages.placeholder')}
            maxLength={1000}
            className="flex-1 h-10 rounded-full bg-surface-container px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button onClick={submit} disabled={!draft.trim() || sending}
            aria-label={t('messages.send')}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-transform">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
