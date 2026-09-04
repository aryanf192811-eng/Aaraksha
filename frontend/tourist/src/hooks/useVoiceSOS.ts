// src/hooks/useVoiceSOS.ts
// Voice-triggered SOS — for when hands are occupied or the screen genuinely
// can't be reached (carrying a child, an injured hand, driving), the same
// "hands-free backup" niche usePanicGesture.ts fills for a pocketed phone.
// Uses the browser's native Web Speech API (SpeechRecognition) — no
// third-party service, no audio ever leaves the device for anything but the
// browser's own on-device/OS speech-to-text, and nothing is sent to
// Aaraksha's servers until an actual SOS fires.
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useSOS } from './useSOS'
import { useSafetyStore } from '../store/safety.store'
import { useAuthStore } from '../store/auth.store'

// The base SpeechRecognition interface isn't in this project's TypeScript
// DOM lib yet (SpeechRecognitionEvent/-ErrorEvent/-Result are, the
// constructor+instance shape isn't) — declared narrowly to just what this
// hook actually uses, not the full spec.
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
}

const CONFIRM_COUNTDOWN_MS = 3000
const COOLDOWN_MS = 60_000 // don't re-arm immediately after a trigger/cancel
// A few phrasings, not one exact string — real speech-to-text output varies
// ("aaraksha" can transcribe as "arakcha"/"arakasha" on noisy input), and
// requiring the wake word AND "help"/"emergency" together (not either
// alone) keeps an ordinary conversation from tripping it.
const WAKE_WORDS = ['aaraksha', 'arakcha', 'arakasha']
const TRIGGER_WORDS = ['help', 'emergency', 'sos']

type SpeechRecognitionConstructor = new () => SpeechRecognition

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isVoiceSOSSupported(): boolean {
  return getSpeechRecognition() !== null
}

function matchesTrigger(transcript: string): boolean {
  const text = transcript.toLowerCase()
  return WAKE_WORDS.some((w) => text.includes(w)) && TRIGGER_WORDS.some((w) => text.includes(w))
}

export function useVoiceSOS() {
  const enabled = useSafetyStore((s) => s.voiceSOSEnabled)
  const setVoiceSOSEnabled = useSafetyStore((s) => s.setVoiceSOSEnabled)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { sendSOS } = useSOS()
  // sendSOS is a fresh closure every render (useSOS isn't memoized) — track
  // via ref, same reasoning as usePanicGesture, so the recognition effect
  // only re-subscribes on real enabled/auth changes.
  const sendSOSRef = useRef(sendSOS)
  sendSOSRef.current = sendSOS

  const cooldownUntilRef = useRef(0)
  const armedRef = useRef(false) // true while a countdown toast is pending
  const stoppedIntentionallyRef = useRef(false)

  useEffect(() => {
    const SpeechRecognitionImpl = getSpeechRecognition()
    if (!enabled || !isAuthenticated || !SpeechRecognitionImpl) return

    const recognition = new SpeechRecognitionImpl()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-IN'
    stoppedIntentionallyRef.current = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const now = Date.now()
      if (now < cooldownUntilRef.current || armedRef.current) return

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript
        if (!transcript || !matchesTrigger(transcript)) continue

        armedRef.current = true
        cooldownUntilRef.current = now + COOLDOWN_MS
        let cancelled = false
        toast.warning('Voice SOS phrase detected — sending SOS in 3s', {
          duration: CONFIRM_COUNTDOWN_MS,
          action: { label: 'Cancel', onClick: () => { cancelled = true } },
        })
        setTimeout(() => {
          armedRef.current = false
          if (!cancelled) sendSOSRef.current('OTHER', 'Triggered via voice SOS phrase')
        }, CONFIRM_COUNTDOWN_MS)
        break
      }
    }

    // Browsers end a continuous session after a period of silence or a
    // background/foreground switch — restart automatically so "enabled"
    // actually means "always listening," not "listening until the next
    // silence." Guarded by stoppedIntentionallyRef so the cleanup below
    // doesn't trigger a restart-after-stop loop.
    recognition.onend = () => {
      if (!stoppedIntentionallyRef.current) {
        try { recognition.start() } catch { /* already starting — ignore */ }
      }
    }

    // 'no-speech' fires constantly in normal silence — not a real error,
    // onend's restart already covers it. Only mic-permission failures are
    // worth surfacing, since those mean the toggle is silently doing
    // nothing until the user re-grants access.
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast.error('Voice SOS needs microphone access — turning it off.')
        setVoiceSOSEnabled(false)
      }
    }

    try {
      recognition.start()
    } catch {
      // Already running from a fast-refresh/remount race — harmless.
    }

    return () => {
      stoppedIntentionallyRef.current = true
      recognition.onend = null
      recognition.onresult = null
      recognition.onerror = null
      recognition.stop()
    }
  }, [enabled, isAuthenticated, setVoiceSOSEnabled])
}
