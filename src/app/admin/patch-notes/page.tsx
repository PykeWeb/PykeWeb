'use client'

import { useEffect, useState } from 'react'
import { getTenantSession } from '@/lib/tenantSession'
import { createPatchNote, deletePatchNote, listPatchNotesAdmin, updatePatchNote, type PatchNote } from '@/lib/communicationApi'

export default function AdminPatchNotesPage() {
  const [patchNotes, setPatchNotes] = useState<PatchNote[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <h1 className="text-3xl font-semibold">Patch notes</h1>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
          <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Contenu" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
          <button onClick={() => void publish()} className="h-10 rounded-2xl border border-white/15 bg-white/[0.09] px-3 text-sm font-semibold hover:bg-white/[0.14]">Publier</button>
        </div>

        <div className="mt-4 space-y-2">
          {patchNotes.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <div>
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="text-xs text-white/70">{p.content}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => void updatePatchNote(p.id, { is_active: !p.is_active }).then(refresh)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">{p.is_active ? 'Désactiver' : 'Activer'}</button>
                <button onClick={() => void deletePatchNote(p.id).then(refresh)} className="h-10 rounded-2xl border border-rose-300/30 bg-rose-500/12 px-3 text-sm text-rose-100 hover:bg-rose-500/22">Supprimer</button>
              </div>
            </div>
          ))}
        </div>

        {error ? <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      </div>
    </div>
  )
}
