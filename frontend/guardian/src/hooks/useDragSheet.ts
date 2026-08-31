// src/hooks/useDragSheet.ts
// No drag/gesture library exists anywhere in this codebase — this is a
// small, dependency-free pointer-based drag-to-dismiss, built on native
// Pointer Events rather than pulling in a new package for one gesture.
// Attach `handleProps` to a drag-handle element only (not the whole sheet),
// so dragging never fights the message list's own scroll.
import { useRef, useState, type PointerEvent } from 'react'

interface UseDragSheetOptions {
  onClose: () => void
  // Drag past this many px down, or flick faster than this (px/ms), and it
  // counts as a dismiss rather than a snap-back.
  closeThresholdPx?: number
  closeVelocity?: number
}

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function useDragSheet({ onClose, closeThresholdPx = 120, closeVelocity = 0.5 }: UseDragSheetOptions) {
  const [translateY, setTranslateY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startYRef = useRef(0)
  const lastYRef = useRef(0)
  const lastTimeRef = useRef(0)
  const velocityRef = useRef(0)

  if (prefersReducedMotion) {
    // No transform-driven drag at all -- close stays reachable only via the
    // explicit close button / backdrop tap, matching the reduced-motion
    // fallback everywhere else animation appears in this app.
    return { handleProps: {}, sheetStyle: {}, dragging: false }
  }

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    setDragging(true)
    startYRef.current = e.clientY
    lastYRef.current = e.clientY
    lastTimeRef.current = performance.now()
    velocityRef.current = 0
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!dragging) return
    // Only downward drag moves the sheet -- dragging up just does nothing,
    // rather than letting the sheet float above its resting position.
    const dy = Math.max(0, e.clientY - startYRef.current)
    setTranslateY(dy)
    const now = performance.now()
    const dt = now - lastTimeRef.current
    if (dt > 0) velocityRef.current = (e.clientY - lastYRef.current) / dt
    lastYRef.current = e.clientY
    lastTimeRef.current = now
  }

  const endDrag = () => {
    if (!dragging) return
    setDragging(false)
    if (translateY > closeThresholdPx || velocityRef.current > closeVelocity) onClose()
    setTranslateY(0)
  }

  return {
    handleProps: {
      onPointerDown, onPointerMove,
      onPointerUp: endDrag, onPointerCancel: endDrag,
      style: { touchAction: 'none' as const, cursor: dragging ? 'grabbing' : 'grab' },
    },
    sheetStyle: {
      transform: translateY ? `translateY(${translateY}px)` : undefined,
      transition: dragging ? 'none' : 'transform 200ms ease-out',
    },
    dragging,
  }
}
