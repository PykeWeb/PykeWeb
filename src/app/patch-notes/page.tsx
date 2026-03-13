'use client'

import { useEffect, useState } from 'react'
import { listActivePatchNotes, type PatchNote } from '@/lib/communicationApi'
import { PatchNoteModal } from '@/components/ui/PatchNoteModal'
import { PageHeader } from '@/components/PageHeader'

export default function PatchNotesPage() {
  const [notes, setNotes] = useState<PatchNote[]>([])
  const [selected, setSelected] = useState<PatchNote | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listActivePatchNotes(20)
      .then((rows) => {
        setNotes(rows)
        setError(null)
      })
      .catch((error: unknown) => setError(error instanceof Error ? error.message : 'Impossible de charger les patch notes'))
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <PageHeader title="Patch notes" subtitle="Toutes les mises à jour publiées." />

        {error ? <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

        <div className="mt-4 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {notes.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/65">Aucune patch note active.</p>
          ) : (
            notes.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelected(n)}
                className="block w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.06]"
              >
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="mt-1 text-xs text-white/55">{new Date(n.created_at).toLocaleString('fr-FR')}</p>
                <p
                  className="mt-1 text-xs text-white/70 whitespace-pre-wrap"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {n.content}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      <PatchNoteModal note={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
