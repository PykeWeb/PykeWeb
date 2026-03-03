'use client'

import { DangerButton, SecondaryButton } from '@/components/ui/design-system'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  cancelLabel?: string
  confirmLabel?: string
  loading?: boolean
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}

export function ConfirmDialog({
  open,
  title,
  description,
  cancelLabel = 'Annuler',
  confirmLabel = 'Supprimer',
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onCancel} aria-label="Fermer" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-slate-950/85 p-5 shadow-2xl shadow-black/60">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{description}</p>

        <div className="mt-5 flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </SecondaryButton>
          <DangerButton type="button" onClick={onConfirm} disabled={loading}>
            {loading ? 'Suppression…' : confirmLabel}
          </DangerButton>
        </div>
      </div>
    </div>
  )
}
