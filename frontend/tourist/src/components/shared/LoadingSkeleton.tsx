// src/components/shared/LoadingSkeleton.tsx
import { cn } from '../../lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      'bg-surface-container-highest rounded-lg animate-pulse',
      className,
    )} />
  )
}

export function TripCardSkeleton() {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-5 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[1, 2, 3].map(i => <TripCardSkeleton key={i} />)}
    </div>
  )
}
