// src/components/shared/MessageThread.tsx
// Reused for both threads this tourist app has: Tourist<->Guardian (always
// available) and Tourist<->Rescuer (scoped to one active assignment). The
// only thing that differs between the two call sites is which hook feeds
// it — this component just renders whatever message list + send callback
// it's given, aligning "mine" bubbles right and everyone else's left.
import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, MessageCircle } from 'lucide-react'
import type { Message } from '../../types/api.types'
import { cn } from '../../lib/utils'

const SENDER_LABELS: Record<Message['sender_kind'], string> = {
  TOURIST: 'You', GUARDIAN: 'Guardian', VOLUNTEER: 'Rescuer', TEAM: 'Rescue Team',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

interface MessageThreadProps {
  messages: Message[] | undefined
  isLoading: boolean
  mine: Message['sender_kind']
  onSend: (body: string) => void
  sending: boolean
  disabledReason?: string | null
  emptyHint: string
}

export function MessageThread({ messages, isLoading, mine, onSend, sending, disabledReason, emptyHint }: MessageThreadProps) {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages?.length])

  const submit = () => {
    const body = draft.trim()
    if (!body || sending || disabledReason) return
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
            <p className="text-xs">{emptyHint}</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_kind === mine
            return (
              <div key={m.id} className={cn('flex flex-col max-w-[78%]', isMine ? 'items-end ml-auto' : 'items-start mr-auto')}>
                <div className={cn('rounded-2xl px-3.5 py-2 text-sm leading-snug break-words',
                  isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-surface-container text-on-surface rounded-bl-sm')}>
                  {m.body}
                </div>
                <span className="text-[10px] text-on-surface-variant mt-0.5 px-1">
                  {!isMine && `${SENDER_LABELS[m.sender_kind]} · `}{formatTime(m.created_at)}
                </span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 border-t border-outline-variant px-3 py-2.5">
        {disabledReason ? (
          <p className="text-xs text-on-surface-variant text-center py-1.5">{disabledReason}</p>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
              placeholder="Type a message…"
              maxLength={1000}
              className="flex-1 h-10 rounded-full bg-surface-container px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button onClick={submit} disabled={!draft.trim() || sending}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-transform">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
