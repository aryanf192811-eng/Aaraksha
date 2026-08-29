// src/lib/selfActionSuppress.ts
// A tourist-initiated SOS status change (e.g. marking their own SOS a false
// alarm) gets its own immediate, accurate toast from the mutation that
// caused it — but the backend also broadcasts the same status change back
// over the socket (so a tourist who *didn't* act, e.g. govt resolved it,
// still finds out), and useSOSStatusListener.ts toasts for that broadcast
// too. For the acting tourist's own device, both fire for the same event.
// This lets a direct mutation mark "I just caused this status change
// myself" for a few seconds, so the socket listener can skip its own
// toast for that specific sosId without skipping the query invalidation
// or state update it still needs to do.
const recentSelfActions = new Map<string, number>()
const SUPPRESS_WINDOW_MS = 5000

export function markSelfAction(sosId: string) {
  recentSelfActions.set(sosId, Date.now())
}

export function wasSelfAction(sosId: string): boolean {
  const at = recentSelfActions.get(sosId)
  if (at == null) return false
  const fresh = Date.now() - at < SUPPRESS_WINDOW_MS
  if (!fresh) recentSelfActions.delete(sosId)
  return fresh
}
