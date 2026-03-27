'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookUser, Clipboard, ClipboardCheck, Pencil, Phone, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { PrimaryButton, SearchInput, SecondaryButton, TabPill } from '@/components/ui/design-system'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  createDirectoryContact,
  deleteDirectoryContact,
  listDirectoryContacts,
  updateDirectoryContact,
  type DirectoryActivity,
  type DirectoryContact,
} from '@/lib/directoryApi'

const ACTIVITY_OPTIONS: Array<{ value: DirectoryActivity; label: string }> = [
  { value: 'coke', label: 'Coke' },
  { value: 'meth', label: 'Meth' },
  { value: 'objects', label: 'Objets' },
  { value: 'weapons', label: 'Armes' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'other', label: 'Autres' },
]

const ACTIVITY_LABELS: Record<DirectoryActivity, string> = {
  coke: 'Coke',
  meth: 'Meth',
  objects: 'Objets',
  weapons: 'Armes',
  equipment: 'Équipement',
  other: 'Autres',
}

type FormState = {
  name: string
  partner_group: string
  phone: string
  activity: DirectoryActivity
  note: string
}

const INITIAL_FORM: FormState = {
  name: '',
  partner_group: '',
  phone: '',
  activity: 'other',
  note: '',
}

function activityTone(activity: DirectoryActivity) {
  if (activity === 'coke') return 'border-cyan-300/40 bg-cyan-500/12 text-cyan-100'
  if (activity === 'meth') return 'border-violet-300/40 bg-violet-500/12 text-violet-100'
  if (activity === 'objects') return 'border-emerald-300/40 bg-emerald-500/12 text-emerald-100'
  if (activity === 'weapons') return 'border-rose-300/40 bg-rose-500/12 text-rose-100'
  if (activity === 'equipment') return 'border-amber-300/40 bg-amber-500/12 text-amber-100'
  return 'border-white/20 bg-white/10 text-white/90'
}

async function copyText(value: string, label: string) {
  if (!value) {
    toast.error(`${label} vide.`)
    return
  }

  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copié.`)
  } catch {
    toast.error(`Impossible de copier ${label.toLowerCase()}.`)
  }
}

export default function AnnuaireClient() {
  const [rows, setRows] = useState<DirectoryContact[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | DirectoryActivity>('all')
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [editing, setEditing] = useState<DirectoryContact | null>(null)
  const [selected, setSelected] = useState<DirectoryContact | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [copiedNameId, setCopiedNameId] = useState<string | null>(null)
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null)

  async function refresh() {
    try {
      setLoading(true)
      setRows(await listDirectoryContacts())
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible de charger les contacts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const stats = useMemo(() => {
    return {
      total: rows.length,
      coke: rows.filter((entry) => entry.activity === 'coke').length,
      meth: rows.filter((entry) => entry.activity === 'meth').length,
      objects: rows.filter((entry) => entry.activity === 'objects').length,
      other: rows.filter((entry) => !['coke', 'meth', 'objects'].includes(entry.activity)).length,
    }
  }, [rows])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return rows.filter((entry) => {
      if (filter !== 'all' && entry.activity !== filter) return false
      if (!normalized) return true
      return `${entry.name} ${entry.partner_group || ''} ${entry.phone || ''}`.toLowerCase().includes(normalized)
    })
  }, [filter, query, rows])

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error('Le nom est obligatoire.')
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await updateDirectoryContact({
          id: editing.id,
          name: form.name,
          partner_group: form.partner_group,
          phone: form.phone,
          activity: form.activity,
          note: form.note,
        })
        toast.success('Contact modifié.')
      } else {
        await createDirectoryContact({
          name: form.name,
          partner_group: form.partner_group,
          phone: form.phone,
          activity: form.activity,
          note: form.note,
        })
        toast.success('Contact créé.')
      }
      setForm(INITIAL_FORM)
      setEditing(null)
      await refresh()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(contact: DirectoryContact) {
    setEditing(contact)
    setForm({
      name: contact.name,
      partner_group: contact.partner_group || '',
      phone: contact.phone || '',
      activity: contact.activity,
      note: contact.note || '',
    })
    setSelected(null)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Annuaire" subtitle="Gère rapidement tes contacts utiles (nom, numéro, activité, notes)." />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <button type="button" onClick={() => setFilter('all')} className={`rounded-2xl border px-4 py-3 text-left ${filter === 'all' ? 'border-slate-200/60 bg-gradient-to-br from-slate-500/28 to-slate-700/20' : 'border-slate-300/25 bg-gradient-to-br from-slate-500/12 to-slate-700/12'}`}>
          <div className="flex items-center justify-between text-slate-100/85"><p className="text-xs">Total contacts</p><Users className="h-4 w-4" /></div>
          <p className="mt-2 text-3xl font-semibold">{stats.total}</p>
        </button>
        <button type="button" onClick={() => setFilter('coke')} className={`rounded-2xl border px-4 py-3 text-left ${filter === 'coke' ? 'border-cyan-200/60 bg-gradient-to-br from-cyan-500/32 to-blue-600/22' : 'border-cyan-300/25 bg-gradient-to-br from-cyan-500/15 to-blue-600/12'}`}>
          <p className="text-xs text-cyan-100/85">Coke</p>
          <p className="mt-2 text-3xl font-semibold">{stats.coke}</p>
        </button>
        <button type="button" onClick={() => setFilter('meth')} className={`rounded-2xl border px-4 py-3 text-left ${filter === 'meth' ? 'border-violet-200/60 bg-gradient-to-br from-violet-500/30 to-fuchsia-600/20' : 'border-violet-300/25 bg-gradient-to-br from-violet-500/12 to-fuchsia-600/12'}`}>
          <p className="text-xs text-violet-100/85">Meth</p>
          <p className="mt-2 text-3xl font-semibold">{stats.meth}</p>
        </button>
        <button type="button" onClick={() => setFilter('objects')} className={`rounded-2xl border px-4 py-3 text-left ${filter === 'objects' ? 'border-emerald-200/60 bg-gradient-to-br from-emerald-500/30 to-teal-600/20' : 'border-emerald-300/25 bg-gradient-to-br from-emerald-500/12 to-teal-600/12'}`}>
          <p className="text-xs text-emerald-100/85">Objets</p>
          <p className="mt-2 text-3xl font-semibold">{stats.objects}</p>
        </button>
        <button type="button" onClick={() => setFilter('other')} className={`rounded-2xl border px-4 py-3 text-left ${filter === 'other' ? 'border-amber-200/60 bg-gradient-to-br from-amber-500/28 to-orange-600/20' : 'border-amber-300/25 bg-gradient-to-br from-amber-500/12 to-orange-600/12'}`}>
          <p className="text-xs text-amber-100/85">Autres</p>
          <p className="mt-2 text-3xl font-semibold">{stats.other}</p>
        </button>
      </div>

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-white/60">Création rapide</p>
            <h2 className="text-xl font-semibold text-white">Nouveau contact</h2>
          </div>
          {editing ? <span className="rounded-full border border-cyan-300/40 bg-cyan-500/14 px-3 py-1 text-xs font-semibold text-cyan-100">Mode modification</span> : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Nom" className="h-11" />
          <Input value={form.partner_group} onChange={(event) => setForm((prev) => ({ ...prev, partner_group: event.target.value }))} placeholder="Groupe" className="h-11" />
          <Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Numéro" className="h-11" />
          <select
            value={form.activity}
            onChange={(event) => setForm((prev) => ({ ...prev, activity: event.target.value as DirectoryActivity }))}
            className="h-11 rounded-xl border border-white/15 bg-white/[0.05] px-3 text-sm text-white outline-none"
          >
            {ACTIVITY_OPTIONS.map((option) => <option key={option.value} value={option.value} className="bg-[#0b1228]">{option.label}</option>)}
          </select>
          <textarea
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="Note"
            className="min-h-[88px] rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none md:col-span-2 xl:col-span-4"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {editing ? (
            <SecondaryButton
              onClick={() => {
                setEditing(null)
                setForm(INITIAL_FORM)
              }}
              className="h-10"
            >
              Annuler modification
            </SecondaryButton>
          ) : null}
          <PrimaryButton disabled={saving} onClick={() => void handleSubmit()} className="h-10 px-4">
            {editing ? 'Enregistrer' : 'Créer le contact'}
          </PrimaryButton>
        </div>
      </Panel>

      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Recherche nom / groupe / numéro" className="w-full max-w-sm" />
          <div className="ml-auto flex flex-wrap gap-2">
            <TabPill active={filter === 'all'} onClick={() => setFilter('all')}>Tous</TabPill>
            {ACTIVITY_OPTIONS.map((option) => (
              <TabPill key={option.value} active={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</TabPill>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-white/70">
              <tr>
                <th className="px-4 py-3 text-left">Nom</th>
                <th className="px-4 py-3 text-left">Groupe</th>
                <th className="px-4 py-3 text-left">Numéro</th>
                <th className="px-4 py-3 text-left">Activité</th>
                <th className="px-4 py-3 text-left">Note</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-white/60">Chargement…</td></tr> : null}
              {!loading && filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-white/60">Aucun contact.</td></tr> : null}
              {!loading ? filtered.map((contact) => (
                <tr key={contact.id} className="cursor-pointer hover:bg-white/[0.04]" onClick={() => setSelected(contact)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold text-white">
                      <span>{contact.name}</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void copyText(contact.name, 'Nom')
                          setCopiedNameId(contact.id)
                          window.setTimeout(() => setCopiedNameId((prev) => (prev === contact.id ? null : prev)), 900)
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06]"
                        title="Copier le nom"
                      >
                        {copiedNameId === contact.id ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/85">{contact.partner_group || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-white/85">
                      <span>{contact.phone || '—'}</span>
                      {contact.phone ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            void copyText(contact.phone || '', 'Numéro')
                            setCopiedPhoneId(contact.id)
                            window.setTimeout(() => setCopiedPhoneId((prev) => (prev === contact.id ? null : prev)), 900)
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06]"
                          title="Copier le numéro"
                        >
                          {copiedPhoneId === contact.id ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${activityTone(contact.activity)}`}>{ACTIVITY_LABELS[contact.activity]}</span></td>
                  <td className="max-w-[280px] px-4 py-3 text-white/75"><p className="line-clamp-2">{contact.note || '—'}</p></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          startEdit(contact)
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/35 bg-cyan-500/15 text-cyan-100"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setDeleteId(contact.id)
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300/35 bg-rose-500/15 text-rose-100"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      {selected ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
            <Panel>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/60">Détail contact</p>
                  <h3 className="text-xl font-semibold text-white">{selected.name}</h3>
                </div>
                <BookUser className="h-5 w-5 text-cyan-100" />
              </div>

              <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                <p><span className="text-white/60">Nom:</span> {selected.name}</p>
                <p><span className="text-white/60">Groupe:</span> {selected.partner_group || '—'}</p>
                <p><span className="text-white/60">Numéro:</span> {selected.phone || '—'}</p>
                <p><span className="text-white/60">Activité:</span> {ACTIVITY_LABELS[selected.activity]}</p>
                <p><span className="text-white/60">Note:</span> {selected.note || '—'}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <SecondaryButton onClick={() => void copyText(selected.name, 'Nom')}>Copier nom</SecondaryButton>
                <SecondaryButton onClick={() => void copyText(selected.phone || '', 'Numéro')}>Copier numéro</SecondaryButton>
                <SecondaryButton onClick={() => startEdit(selected)} icon={<Pencil className="h-4 w-4" />}>Modifier</SecondaryButton>
                <SecondaryButton onClick={() => setDeleteId(selected.id)} icon={<Trash2 className="h-4 w-4" />}>Supprimer</SecondaryButton>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Supprimer ce contact ?"
        description="Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return
          try {
            await deleteDirectoryContact(deleteId)
            toast.success('Contact supprimé.')
            setDeleteId(null)
            setSelected((prev) => (prev?.id === deleteId ? null : prev))
            await refresh()
          } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Suppression impossible.')
          }
        }}
      />
    </div>
  )
}
