// src/store/auth.store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStorage } from '../lib/db'
import type { Tourist, GovtUser } from '../types/api.types'

// Token lives in Zustand state, mirrored to IndexedDB so a login survives a
// full close-and-reopen of the installed PWA — the app is a safety tool
// used over multi-day trips in low-connectivity areas, and re-authenticating
// every time it's relaunched is a real barrier, not just an inconvenience.
// (Previously sessionStorage-only, which cleared on every app close —
// changed on explicit request.)
interface AuthState {
  token: string | null
  tourist: Tourist | null
  govtUser: GovtUser | null
  isAuthenticated: boolean
  // IndexedDB reads are async — unlike the old sessionStorage-backed store,
  // the very first render has none of the persisted state loaded yet. Route
  // guards must wait for this to flip true before trusting isAuthenticated,
  // or a genuinely logged-in tourist gets bounced to /auth for one frame on
  // every cold start. Set once by onRehydrateStorage below; deliberately
  // excluded from partialize since it's a per-load runtime flag, not
  // something to persist.
  hasHydrated: boolean
  setHasHydrated: (value: boolean) => void
  setAuth: (token: string, tourist: Tourist) => void
  setGovtAuth: (token: string, govtUser: GovtUser) => void
  updateTourist: (updates: Partial<Tourist>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      tourist: null,
      govtUser: null,
      isAuthenticated: false,
      hasHydrated: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),

      setAuth: (token, tourist) =>
        set({ token, tourist, isAuthenticated: true }),

      setGovtAuth: (token, govtUser) =>
        set({ token, govtUser, isAuthenticated: true }),

      updateTourist: (updates) =>
        set((state) => ({
          tourist: state.tourist ? { ...state.tourist, ...updates } : null,
        })),

      logout: () =>
        set({ token: null, tourist: null, govtUser: null, isAuthenticated: false }),
    }),
    {
      name: 'aaraksha-auth',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        token: state.token, tourist: state.tourist, govtUser: state.govtUser,
        isAuthenticated: state.isAuthenticated,
      }),
      // Called once hydration ends either way — reading useAuthStore
      // directly (rather than trusting the `state` argument) so a failed
      // read still unblocks route guards instead of leaving hasHydrated
      // stuck false forever.
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hasHydrated: true })
      },
    }
  )
)
