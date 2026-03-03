'use client'

import { useEffect } from 'react'

export type PatchNoteLike = {
  id: string
  title: string
  content: string
  created_at: string
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('fr-FR')
  } catch {
    return value
  }
}

export function PatchNoteModal({
  note,
  onClose,
}: {
  note: PatchNoteLike | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!note) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [note, onClose])

  if (!note) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1625]/95 shadow-glow max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-semibold">{note.title}</h2>
            <p className="mt-1 text-xs text-white/60">{formatDate(note.created_at)}</p>
          </div>
          <button
            onClick={onClose}
            className="h-10 rounded-2xl border border-white/15 bg-white/[0.08] px-4 text-sm hover:bg-white/[0.14]"
          >
            Fermer
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <p className="text-sm leading-6 text-white/80 whitespace-pre-wrap">{note.content}</p>
        </div>
      </div>
    </div>
  )
}
