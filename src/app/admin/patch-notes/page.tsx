'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getTenantSession } from '@/lib/tenantSession'
import { createPatchNote, deletePatchNote, listPatchNotesAdmin, updatePatchNote, type PatchNote } from '@/lib/communicationApi'

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('fr-FR')
  } catch {
    return value
  }
}

function PatchNoteModal({ note, onClose }: { note: PatchNote | null; onClose: () => void }) {
  if (!note) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1625]/95 shadow-glow"
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
          <p className="text-sm leading-6 text-white/80 whitespace-pre-line">{note.content}</p>
        </div>
      </div>
    </div>
  )
}

function PatchNoteCard({
  note,
  onOpen,
  onToggleActive,
  onDelete,
}: {
  note: PatchNote
  onOpen: (note: PatchNote) => void
  onToggleActive: (note: PatchNote) => void
  onDelete: (note: PatchNote) => void
}) {
  const previewRef = useRef<HTMLParagraphElement | null>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const el = previewRef.current
    if (!el) return

    const checkOverflow = () => {
      setIsOverflowing(el.scrollHeight > el.clientHeight + 1)
    }

    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [note.content])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{note.title}</p>
          <p className="mt-1 text-xs text-white/60">{formatDate(note.created_at)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => onToggleActive(note)}
            className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]"
          >
            {note.is_active ? 'Désactiver' : 'Activer'}
          </button>
          <button
            onClick={() => onDelete(note)}
            className="h-10 rounded-2xl border border-rose-300/30 bg-rose-500/12 px-3 text-sm text-rose-100 hover:bg-rose-500/22"
          >
            Supprimer
          </button>
        </div>
      </div>

      <p
        ref={previewRef}
        className="mt-2 text-xs leading-5 text-white/70 whitespace-pre-line"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {note.content}
      </p>

      {isOverflowing ? (
        <button
          onClick={() => onOpen(note)}
          className="mt-2 text-xs font-medium text-white/80 underline decoration-white/40 underline-offset-2 hover:text-white"
        >
          Voir tout
        </button>
      ) : null}
    </div>
  )
}

export default function AdminPatchNotesPage() {
  const [patchNotes, setPatchNotes] = useState<PatchNote[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PatchNote | null>(null)

  async function refresh() {
    try {
      setPatchNotes(await listPatchNotesAdmin())
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Erreur patch notes')
    }
  }

  useEffect(() => {
    const session = getTenantSession()
    if (!session?.isAdmin) {
      window.location.href = '/'
      return
    }
    void refresh()
  }, [])

  async function publish() {
    if (!title.trim() || !content.trim()) return
    try {
      await createPatchNote({ title: title.trim(), content: content.trim(), is_active: true })
      setTitle('')
      setContent('')
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Impossible de publier')
    }
  }

  const sortedNotes = useMemo(
    () => [...patchNotes].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [patchNotes]
  )

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <h1 className="text-3xl font-semibold">Patch notes</h1>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
            className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Contenu"
            className="min-h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 py-2 text-sm md:h-10 md:py-2"
          />
          <button
            onClick={() => void publish()}
            className="h-10 rounded-2xl border border-white/15 bg-white/[0.09] px-3 text-sm font-semibold hover:bg-white/[0.14]"
          >
            Publier
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {sortedNotes.map((p) => (
            <PatchNoteCard
              key={p.id}
              note={p}
              onOpen={setSelected}
              onToggleActive={(note) => void updatePatchNote(note.id, { is_active: !note.is_active }).then(refresh)}
              onDelete={(note) => void deletePatchNote(note.id).then(refresh)}
            />
          ))}
        </div>

        {error ? <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      </div>

      <PatchNoteModal note={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
