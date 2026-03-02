'use client'

import { useEffect, useState } from 'react'
import {
  createTenantGroup,
  deleteTenantGroup,
  listTenantGroups,
  updateTenantGroup,
  type TenantGroup,
} from '@/lib/tenantAuthApi'
import {
  createPatchNote,
  listPatchNotesAdmin,
  listSupportTicketsAdmin,
  updatePatchNote,
  updateSupportTicketStatus,
  type PatchNote,
  type SupportTicket,
} from '@/lib/communicationApi'
import { getTenantSession } from '@/lib/tenantSession'

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<TenantGroup[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBadge, setNewBadge] = useState('PF')
  const [newLogin, setNewLogin] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [patchNotes, setPatchNotes] = useState<PatchNote[]>([])
  const [bugs, setBugs] = useState<SupportTicket[]>([])
  const [messages, setMessages] = useState<SupportTicket[]>([])
  const [pnTitle, setPnTitle] = useState('')
  const [pnContent, setPnContent] = useState('')
  const [showResolvedTickets, setShowResolvedTickets] = useState(false)
  const [globalCategory, setGlobalCategory] = useState<'object' | 'weapon' | 'equipment' | 'drug'>('object')
  const [globalName, setGlobalName] = useState('')
  const [globalPrice, setGlobalPrice] = useState('0')
  const [globalItems, setGlobalItems] = useState<any[]>([])

  const now = Date.now()
  const activeCount = groups.filter((g) => g.active).length
  const expiredCount = groups.filter((g) => g.paid_until && new Date(g.paid_until).getTime() < now).length
  const unlimitedCount = groups.filter((g) => !g.paid_until).length

  async function refresh(showResolved = showResolvedTickets) {
    try {
      const [tenantGroups, notes, bugRows, msgRows, globals] = await Promise.all([
        listTenantGroups(),
        listPatchNotesAdmin(),
        listSupportTicketsAdmin('bug', showResolved),
        listSupportTicketsAdmin('message', showResolved),
        fetch('/api/admin/global-catalog', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
      ])
      setGroups(tenantGroups)
      setPatchNotes(notes)
      setBugs(bugRows)
      setMessages(msgRows)
      setGlobalItems(Array.isArray(globals) ? globals : [])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Erreur chargement admin')
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

  useEffect(() => {
    void refresh(showResolvedTickets)
  }, [showResolvedTickets])

  async function addGroup() {
    if (!newName.trim() || !newLogin.trim() || !newPassword.trim()) {
      setError('Nom, identifiant et mot de passe sont obligatoires.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const paidUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      await createTenantGroup({
        name: newName.trim(),
        badge: newBadge,
        login: newLogin.trim(),
        password: newPassword,
        active: true,
        paid_until: paidUntil,
      })

      setNewName('')
      setNewBadge('PF')
      setNewLogin('')
      setNewPassword('')
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Impossible de créer le groupe.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function editGroupIdentity(group: TenantGroup) {
    const nextName = window.prompt('Nom du groupe :', group.name)
    if (nextName === null) return
    const nextBadge = window.prompt('Badge (PF / Gang / Organisation / Famille / Indépendant) :', group.badge || 'PF')
    if (nextBadge === null) return
    const nextLogin = window.prompt('Identifiant :', group.login)
    if (nextLogin === null) return
    const nextPassword = window.prompt('Mot de passe :', group.password || '')
    if (nextPassword === null) return

    try {
      await updateTenantGroup(group.id, {
        name: nextName.trim() || group.name,
        badge: nextBadge.trim() || group.badge,
        login: nextLogin.trim() || group.login,
        password: nextPassword,
      })
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Impossible de modifier le groupe.')
    }
  }

  async function addCustomDays(group: TenantGroup) {
    const rawDays = window.prompt('Ajouter combien de jours ?', '7')
    if (rawDays === null) return
    const days = Number(rawDays)
    if (!Number.isFinite(days) || days <= 0) {
      setError('Nombre de jours invalide.')
      return
    }

    try {
      const baseTs = group.paid_until ? new Date(group.paid_until).getTime() : Date.now()
      const next = new Date(Math.max(Date.now(), baseTs) + days * 24 * 60 * 60 * 1000)
      await updateTenantGroup(group.id, { paid_until: next.toISOString() })
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Impossible de prolonger le groupe.')
    }
  }

  async function setUnlimited(group: TenantGroup) {
    try {
      await updateTenantGroup(group.id, { paid_until: null })
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Impossible de passer en illimité.')
    }
  }


  async function setTicketStatus(id: string, status: SupportTicket['status']) {
    try {
      await updateSupportTicketStatus(id, status)
      await refresh(showResolvedTickets)
    } catch (e: any) {
      setError(e?.message || 'Impossible de mettre à jour le ticket.')
    }
  }


  async function addGlobalItem() {
    if (!globalName.trim()) return
    try {
      const res = await fetch('/api/admin/global-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: globalCategory, name: globalName.trim(), price: Number(globalPrice || 0) }),
      })
      if (!res.ok) throw new Error(await res.text())
      setGlobalName('')
      setGlobalPrice('0')
      await refresh(showResolvedTickets)
    } catch (e: any) {
      setError(e?.message || 'Impossible d’ajouter un item global.')
    }
  }

  async function deleteGlobalItem(id: string) {
    try {
      const res = await fetch('/api/admin/global-catalog', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error(await res.text())
      await refresh(showResolvedTickets)
    } catch (e: any) {
      setError(e?.message || 'Impossible de supprimer l’item global.')
    }
  }

  async function addPatchNote() {
    if (!pnTitle.trim() || !pnContent.trim()) return
    try {
      await createPatchNote({ title: pnTitle.trim(), content: pnContent.trim(), is_active: true })
      setPnTitle('')
      setPnContent('')
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Impossible d’ajouter la patch note.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <h1 className="text-xl font-bold">Admin • Gestion des groupes</h1>
        <p className="mt-1 text-sm text-white/70">Créer, désactiver, prolonger, supprimer et gérer les identifiants.</p>

        <form className="mt-4 grid gap-2 md:grid-cols-5" onSubmit={(e) => { e.preventDefault(); void addGroup() }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom groupe" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <select value={newBadge} onChange={(e) => setNewBadge(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <option value="PF">PF</option><option value="Gang">Gang</option><option value="Organisation">Organisation</option><option value="Famille">Famille</option><option value="Indépendant">Indépendant</option>
          </select>
          <input value={newLogin} onChange={(e) => setNewLogin(e.target.value)} placeholder="Identifiant" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mot de passe" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <button type="submit" disabled={isSubmitting} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold">{isSubmitting ? 'Création…' : 'Créer'}</button>
        </form>

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"><p className="text-white/60">Groupes actifs</p><p className="text-lg font-semibold">{activeCount}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"><p className="text-white/60">Groupes expirés</p><p className="text-lg font-semibold">{expiredCount}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"><p className="text-white/60">Groupes illimités</p><p className="text-lg font-semibold">{unlimitedCount}</p></div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/70"><tr><th className="px-3 py-2 text-left">Groupe</th><th className="px-3 py-2 text-left">Identifiant</th><th className="px-3 py-2 text-left">Actif</th><th className="px-3 py-2 text-left">Payé jusqu’au</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-t border-white/10">
                  <td className="px-3 py-2">{g.name} <span className="text-white/60">({g.badge || 'GROUPE'})</span></td>
                  <td className="px-3 py-2">{g.login}</td>
                  <td className="px-3 py-2">{g.active ? 'Oui' : 'Non'}</td>
                  <td className="px-3 py-2">{g.paid_until ? new Date(g.paid_until).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-3 py-2 text-right"><div className="inline-flex gap-2">
                    <button onClick={() => void editGroupIdentity(g)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">Modifier</button>
                    <button onClick={() => void updateTenantGroup(g.id, { active: !g.active }).then(() => refresh())} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">{g.active ? 'Désactiver' : 'Activer'}</button>
                    <button onClick={() => void addCustomDays(g)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">+ jours</button>
                    <button onClick={() => void setUnlimited(g)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">Illimité</button>
                    <button onClick={() => void (window.confirm(`Supprimer ${g.name} ?`) ? deleteTenantGroup(g.id).then(() => refresh()) : Promise.resolve())} className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-rose-200">Supprimer</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <h2 className="text-lg font-semibold">Catalogue global</h2>
        <p className="mt-1 text-xs text-white/70">Les items ajoutés ici apparaissent dans tous les groupes (override local possible).</p>
        <div className="mt-3 grid gap-2 md:grid-cols-[180px_1fr_160px_auto]">
          <select value={globalCategory} onChange={(e) => setGlobalCategory(e.target.value as any)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <option value="object">Objets</option><option value="weapon">Armes</option><option value="equipment">Équipement</option><option value="drug">Drogues</option>
          </select>
          <input value={globalName} onChange={(e) => setGlobalName(e.target.value)} placeholder="Nom" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <input value={globalPrice} onChange={(e) => setGlobalPrice(e.target.value)} placeholder="Prix" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <button onClick={() => void addGlobalItem()} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold">Ajouter</button>
        </div>
        <div className="mt-3 space-y-2">
          {globalItems.filter((it) => it.category === globalCategory).map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <p>{it.name} <span className="text-white/60">({Number(it.price || 0).toFixed(2)}$)</span></p>
              <button onClick={() => void deleteGlobalItem(it.id)} className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">Supprimer</button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <h2 className="text-lg font-semibold">Patch notes</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <input value={pnTitle} onChange={(e) => setPnTitle(e.target.value)} placeholder="Titre" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <input value={pnContent} onChange={(e) => setPnContent(e.target.value)} placeholder="Contenu" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <button onClick={() => void addPatchNote()} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold">Publier</button>
        </div>
        <div className="mt-3 space-y-2">
          {patchNotes.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <div>
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="text-xs text-white/70">{p.content}</p>
              </div>
              <button onClick={() => void updatePatchNote(p.id, { is_active: !p.is_active }).then(() => refresh())} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs">{p.is_active ? 'Désactiver' : 'Activer'}</button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Tickets Support</h2>
          <label className="inline-flex items-center gap-2 text-xs text-white/80">
            <input type="checkbox" checked={showResolvedTickets} onChange={(e) => setShowResolvedTickets(e.target.checked)} className="h-3.5 w-3.5 rounded border-white/20 bg-white/5" />
            Afficher les résolus
          </label>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold">Bugs</p>
            <div className="mt-2 space-y-2">
              {bugs.length === 0 ? <p className="text-xs text-white/60">Aucun ticket bug.</p> : null}
              {bugs.map((b) => (
                <div key={b.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
                  <p className="font-medium">{b.tenant_groups?.name || b.group_id} — {new Date(b.created_at).toLocaleString()}</p>
                  <p className="mt-1 text-white/70">{b.message}</p>
                  {b.image_url ? <a href={b.image_url} target="_blank" className="mt-1 block underline">Voir image</a> : null}
                  <select value={b.status} onChange={(e) => void setTicketStatus(b.id, e.target.value as SupportTicket['status'])} className="mt-2 rounded border border-white/10 bg-white/5 px-2 py-1">
                    <option value="open">Ouvert</option><option value="in_progress">En cours</option><option value="resolved">Résolu</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold">Messages</p>
            <div className="mt-2 space-y-2">
              {messages.length === 0 ? <p className="text-xs text-white/60">Aucun message.</p> : null}
              {messages.map((m) => (
                <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
                  <p className="font-medium">{m.tenant_groups?.name || m.group_id} — {new Date(m.created_at).toLocaleString()}</p>
                  <p className="mt-1 text-white/70">{m.message}</p>
                  {m.image_url ? <a href={m.image_url} target="_blank" className="mt-1 block underline">Voir image</a> : null}
                  <select value={m.status} onChange={(e) => void setTicketStatus(m.id, e.target.value as SupportTicket['status'])} className="mt-2 rounded border border-white/10 bg-white/5 px-2 py-1">
                    <option value="open">Ouvert</option><option value="in_progress">En cours</option><option value="resolved">Résolu</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
