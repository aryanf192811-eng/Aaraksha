// src/components/AppLayout.tsx
// Shared shell for every authenticated page: renders the routed page via
// Outlet, then the persistent bottom nav. Previously each page rendered its
// own <BottomNav/> (or, for 8 of 10 pages, simply forgot to) — navigating
// between pages made the nav flicker in and out, breaking the app's basic
// navigation consistency. One layout, wired once in main.tsx, fixes it for
// every route at once.
import { Outlet } from 'react-router-dom'
import { BottomNav } from './shared'

export function AppLayout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  )
}
