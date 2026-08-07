// src/store/auth.store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Tourist, GovtUser } from '../types/api.types'

// Token lives in Zustand state (in-memory during the session); the persist
// middleware mirrors it to sessionStorage only, so it survives a reload but
// not a browser restart or a new tab — never localStorage.
interface AuthState {
  token: string | null
  tourist: Tourist | null
  govtUser: GovtUser | null
  isAuthenticated: boolean
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
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        token: state.token, tourist: state.tourist, govtUser: state.govtUser,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
