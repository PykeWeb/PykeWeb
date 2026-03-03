'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PatchNote } from '@/lib/communicationApi'

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('fr-FR')
  } catch {
    return value
  }
}

export function PatchNotesRecapModal({
  open,
  notes,
  onClose,
  onRead,
}: {
  open: boolean
  notes: PatchNote[]
  onClose: () => void
  onRead: (note: PatchNote) => void
}) {
  const [query, setQuery] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveOnly(true)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes
      .filter((n) => !activeOnly || n.is_active)
      .filter((n) => {
        if (!q) return true
        return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      })
  }, [notes, query, activeOnly])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1625]/95 shadow-glow max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/10 px-4 py-4 sm:px-6">
          <h2 className="text-xl font-semibold">Patch notes</h2>
          <p className="mt-1 text-sm text-white/65">Toutes les mises à jour</p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm outline-none"
            />
            <label className="inline-flex items-center gap-2 text-sm text-white/75">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5"
              />
              Actifs uniquement
            </label>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 sm:px-6 sm:pb-6 sm:pt-4">
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/65">Aucune patch note trouvée.</p>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => onRead(n)}
                className="block w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="mt-1 text-xs text-white/55">{formatDate(n.created_at)}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.08] px-2 py-0.5 text-[11px] text-white/80">
                    {n.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <p
                  className="mt-2 text-xs text-white/70 whitespace-pre-wrap"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {n.content}
                </p>
                <span className="mt-2 inline-block text-xs font-medium text-white/80 underline decoration-white/40 underline-offset-2">Lire</span>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3 sm:px-6">
          <button onClick={onClose} className="h-10 rounded-2xl border border-white/15 bg-white/[0.08] px-4 text-sm hover:bg-white/[0.14]">Fermer</button>
        </div>
      </div>
    </div>
  )
}
