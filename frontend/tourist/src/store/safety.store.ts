// src/store/safety.store.ts
import { create } from 'zustand'

interface SafetyState {
  activeSOSId: string | null
  dmsId: string | null
  dmsSecondsRemaining: number | null
  dmsWarning: boolean         // true when < 10 min remaining
  isOnline: boolean
  setActiveSOSId: (id: string | null) => void
  setDMS: (id: string | null, seconds: number | null) => void
  setDMSWarning: (warning: boolean) => void
  setOnlineStatus: (online: boolean) => void
}

export const useSafetyStore = create<SafetyState>((set) => ({
  activeSOSId: null,
  dmsId: null,
  dmsSecondsRemaining: null,
  dmsWarning: false,
  isOnline: navigator.onLine,
  setActiveSOSId: (id) => set({ activeSOSId: id }),
  setDMS: (id, seconds) => set({ dmsId: id, dmsSecondsRemaining: seconds }),
  setDMSWarning: (warning) => set({ dmsWarning: warning }),
  setOnlineStatus: (online) => set({ isOnline: online }),
}))
