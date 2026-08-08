// src/store/safety.store.ts
import { create } from 'zustand'

const PANIC_GESTURE_KEY = 'aaraksha-panic-gesture-enabled'

interface SafetyState {
  activeSOSId: string | null
  dmsId: string | null
  dmsSecondsRemaining: number | null
  dmsWarning: boolean         // true when < 10 min remaining
  isOnline: boolean
  panicGestureEnabled: boolean // shake-to-SOS backup, for when the phone is out of reach
  setActiveSOSId: (id: string | null) => void
  setDMS: (id: string | null, seconds: number | null) => void
  setDMSWarning: (warning: boolean) => void
  setOnlineStatus: (online: boolean) => void
  setPanicGestureEnabled: (enabled: boolean) => void
}

export const useSafetyStore = create<SafetyState>((set) => ({
  activeSOSId: null,
  dmsId: null,
  dmsSecondsRemaining: null,
  dmsWarning: false,
  isOnline: navigator.onLine,
  // Not sensitive — a plain localStorage flag (unlike auth) is enough to
  // survive reloads without pulling in the persist middleware for one bool.
  panicGestureEnabled: localStorage.getItem(PANIC_GESTURE_KEY) === 'true',
  setActiveSOSId: (id) => set({ activeSOSId: id }),
  setDMS: (id, seconds) => set({ dmsId: id, dmsSecondsRemaining: seconds }),
  setDMSWarning: (warning) => set({ dmsWarning: warning }),
  setOnlineStatus: (online) => set({ isOnline: online }),
  setPanicGestureEnabled: (enabled) => {
    localStorage.setItem(PANIC_GESTURE_KEY, String(enabled))
    set({ panicGestureEnabled: enabled })
  },
}))
