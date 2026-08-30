// src/components/ScrollToTop.tsx
// React Router doesn't reset scroll position on navigation — a new route
// renders already scrolled to wherever the previous page was left, hiding
// its own heading under whatever content used to be at that scroll offset.
// Resets on every pathname change (not search/hash, so in-page filters and
// anchor links keep their own behavior).
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
