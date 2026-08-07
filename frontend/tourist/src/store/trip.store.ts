// src/store/trip.store.ts
import { create } from 'zustand'

interface TripState {
  activeTripId: string | null
  currentStopIndex: number
  createTripStep: number      // wizard step 1-3
  setActiveTripId: (id: string | null) => void
  setCreateTripStep: (step: number) => void
  setCurrentStopIndex: (idx: number) => void
  reset: () => void
}

export const useTripStore = create<TripState>((set) => ({
  activeTripId: null,
  currentStopIndex: 0,
  createTripStep: 1,
  setActiveTripId: (id) => set({ activeTripId: id }),
  setCreateTripStep: (step) => set({ createTripStep: step }),
  setCurrentStopIndex: (idx) => set({ currentStopIndex: idx }),
  reset: () => set({ activeTripId: null, currentStopIndex: 0, createTripStep: 1 }),
}))
