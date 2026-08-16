// src/store/auth.store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Volunteer } from '../types/api.types'

// Token lives in Zustand state, mirrored to sessionStorage only — survives
// a reload but not a browser restart or a new tab, matching the tourist/
// govt portals' auth.store.ts convention (never localStorage).
interface AuthState {
  token: string | null
  volunteer: Volunteer | null
  isAuthenticated: boolean
  setAuth: (token: string, volunteer: Volunteer) => void
  updateVolunteer: (updates: Partial<Volunteer>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      volunteer: null,
      isAuthenticated: false,

      setAuth: (token, volunteer) => set({ token, volunteer, isAuthenticated: true }),

      updateVolunteer: (updates) =>
        set((state) => ({
          volunteer: state.volunteer ? { ...state.volunteer, ...updates } : null,
        })),

      logout: () => set({ token: null, volunteer: null, isAuthenticated: false }),
    }),
    {
      name: 'aaraksha-volunteer-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        token: state.token, volunteer: state.volunteer, isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
