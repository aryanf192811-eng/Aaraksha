// src/components/shared/ConfirmDialog.tsx
// Generic yes/no confirmation modal — no destructive action anywhere in the
// tourist app asked for confirmation before this (grep for `confirm(` /
// `AlertDialog` turned up nothing at all), so deleting a trip stop, an
// activity, or disabling a Dead Man's Switch all fired immediately on tap.
// One reusable dialog instead of a bespoke one per call site.
import { Loader2, TriangleAlert } from 'lucide-react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { cn } from '../../lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red/destructive styling (default) vs a neutral primary-colored confirm
   *  for actions that are reversible or merely consequential, not destructive. */
  destructive?: boolean
  pending?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = true, pending = false, onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
              destructive ? 'bg-sos/15' : 'bg-primary/15')}>
              <TriangleAlert className={cn('w-4 h-4', destructive ? 'text-sos-dark' : 'text-primary-dark')} />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)} className="rounded-full">
            {cancelLabel}
          </Button>
          <Button disabled={pending} onClick={onConfirm}
            className={cn('rounded-full font-bold flex items-center gap-2',
              destructive ? 'bg-sos hover:bg-sos-dark text-white' : 'bg-primary hover:brightness-95 text-on-surface')}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
