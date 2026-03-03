'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getTenantSession } from '@/lib/tenantSession'
import { createPatchNote, deletePatchNote, listPatchNotesAdmin, updatePatchNote, type PatchNote } from '@/lib/communicationApi'
import { PatchNoteModal } from '@/components/ui/PatchNoteModal'

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('fr-FR')
  } catch {
    return value
  }
}

function PatchNoteFormModal({
  mode,
  note,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  note: PatchNote | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const contentRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setTitle(note?.title ?? '')
    setContent(note?.content ?? '')
    setError(null)
  }, [note])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.max(el.scrollHeight, 180)}px`
  }, [content, note])

  useEffect(() => {
    if (!note) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [note, onClose])

  if (!note) return null

  async function save() {
    if (!note) return
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (mode === 'create') {
        await createPatchNote({ title: title.trim(), content: content.trim(), is_active: true })
      } else {
        await updatePatchNote(note.id, { title: title.trim(), content: content.trim() })
      }
      await onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Impossible de sauvegarder')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        className="flex w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-[#0f1625]/95 p-5 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold">{mode === 'create' ? 'Créer patch note' : 'Éditer patch note'}</h2>
        <p className="mt-1 text-xs text-white/60">{mode === 'create' ? 'Nouveau patch note' : formatDate(note.created_at)}</p>

        <div className="mt-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
            className="h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm"
          />
          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Contenu"
            className="min-h-[180px] w-full resize-y overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/12 bg-white/[0.06] px-3 py-3 text-sm"
          />
        </div>

        {error ? <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm hover:bg-white/[0.12]">Annuler</button>
          <button onClick={() => void save()} disabled={saving} className="h-10 rounded-2xl border border-white/15 bg-white/[0.09] px-4 text-sm font-semibold hover:bg-white/[0.14] disabled:opacity-60">{saving ? 'Enregistrement…' : mode === 'create' ? 'Publier' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

function PatchNoteCard({
  note,
  onOpen,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  note: PatchNote
  onOpen: (note: PatchNote) => void
  onEdit: (note: PatchNote) => void
  onToggleActive: (note: PatchNote) => void
  onDelete: (note: PatchNote) => void
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => onOpen(note)} className="min-w-0 text-left">
          <p className="text-sm font-semibold">{note.title}</p>
          <p className="mt-1 text-xs text-white/60">{formatDate(note.created_at)}</p>
        </button>

        <div className="flex shrink-0 gap-2">
          <button onClick={() => onOpen(note)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">Lire</button>
          <button onClick={() => onEdit(note)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">Éditer</button>
          <button onClick={() => onToggleActive(note)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">{note.is_active ? 'Désactiver' : 'Activer'}</button>
          <button onClick={() => onDelete(note)} className="h-10 rounded-2xl border border-rose-300/30 bg-rose-500/12 px-3 text-sm text-rose-100 hover:bg-rose-500/22">Supprimer</button>
        </div>
      </div>

      <button onClick={() => onOpen(note)} className="mt-2 block w-full text-left">
        <p
          className="text-xs leading-5 text-white/70 whitespace-pre-wrap"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {note.content}
        </p>
      </button>
    </div>
  )
}

export default function AdminPatchNotesPage() {
  const [patchNotes, setPatchNotes] = useState<PatchNote[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PatchNote | null>(null)
  const [editing, setEditing] = useState<PatchNote | null>(null)
  const [creating, setCreating] = useState(false)

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

  const sortedNotes = useMemo(
    () => [...patchNotes].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [patchNotes]
  )

  const createDraft: PatchNote = {
    id: 'create-draft',
    title: '',
    content: '',
    is_active: true,
    created_at: new Date().toISOString(),
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold">Patch notes</h1>
          <button onClick={() => setCreating(true)} className="h-10 rounded-2xl border border-white/15 bg-white/[0.09] px-4 text-sm font-semibold hover:bg-white/[0.14]">Créer</button>
        </div>

        <div className="mt-4 space-y-2">
          {sortedNotes.map((p) => (
            <PatchNoteCard
              key={p.id}
              note={p}
              onOpen={setSelected}
              onEdit={setEditing}
              onToggleActive={(note) => void updatePatchNote(note.id, { is_active: !note.is_active }).then(refresh)}
              onDelete={(note) => void deletePatchNote(note.id).then(refresh)}
            />
          ))}
        </div>

        {error ? <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      </div>

      <PatchNoteModal note={selected} onClose={() => setSelected(null)} />
      <PatchNoteFormModal mode="edit" note={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <PatchNoteFormModal mode="create" note={creating ? createDraft : null} onClose={() => setCreating(false)} onSaved={refresh} />
    </div>
  )
}
