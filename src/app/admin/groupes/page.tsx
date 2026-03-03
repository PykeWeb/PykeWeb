'use client'

import { useEffect, useState } from 'react'
import {
  createTenantGroup,
  deleteTenantGroup,
  listTenantGroups,
  updateTenantGroup,
  type TenantGroup,
} from '@/lib/tenantAuthApi'
import { getTenantSession } from '@/lib/tenantSession'

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<TenantGroup[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBadge, setNewBadge] = useState('PF')
  const [newLogin, setNewLogin] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const now = Date.now()
  const activeCount = groups.filter((g) => g.active).length
  const expiredCount = groups.filter((g) => g.paid_until && new Date(g.paid_until).getTime() < now).length
  const unlimitedCount = groups.filter((g) => !g.paid_until).length

  async function refresh() {
    try {
      const tenantGroups = await listTenantGroups()
      setGroups(tenantGroups)
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

  async function toggleActive(group: TenantGroup) {
    try {
      await updateTenantGroup(group.id, { active: !group.active })
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Impossible de changer l’état du groupe.')
    }
  }

  async function removeGroup(group: TenantGroup) {
    if (!window.confirm(`Supprimer le groupe "${group.name}" ?`)) return
    try {
      await deleteTenantGroup(group.id)
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Impossible de supprimer le groupe.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <h1 className="text-4xl font-semibold tracking-tight">Admin • Gestion des groupes</h1>
        <p className="mt-2 text-lg text-white/70">Créer, désactiver, prolonger, supprimer et gérer les identifiants.</p>

        <div className="mt-5 grid gap-3 lg:grid-cols-5">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom groupe" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm" />
          <select value={newBadge} onChange={(e) => setNewBadge(e.target.value)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm">
            <option value="PF">PF</option>
            <option value="Gang">Gang</option>
            <option value="Organisation">Organisation</option>
            <option value="Famille">Famille</option>
            <option value="Indépendant">Indépendant</option>
          </select>
          <input value={newLogin} onChange={(e) => setNewLogin(e.target.value)} placeholder="Identifiant" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm" />
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="Mot de passe" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm" />
          <button disabled={isSubmitting} onClick={() => void addGroup()} className="h-10 rounded-2xl border border-white/15 bg-white/[0.09] px-4 text-sm font-semibold hover:bg-white/[0.14]">{isSubmitting ? 'Création…' : 'Créer'}</button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"><p className="text-sm text-white/60">Groupes actifs</p><p className="text-4xl font-semibold">{activeCount}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"><p className="text-sm text-white/60">Groupes expirés</p><p className="text-4xl font-semibold">{expiredCount}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"><p className="text-sm text-white/60">Groupes illimités</p><p className="text-4xl font-semibold">{unlimitedCount}</p></div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-white/70">
              <tr>
                <th className="px-4 py-3">Groupe</th>
                <th className="px-4 py-3">Identifiant</th>
                <th className="px-4 py-3">Actif</th>
                <th className="px-4 py-3">Payé jusqu’au</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id} className="border-t border-white/10">
                  <td className="px-4 py-3 font-medium">{group.name} {group.badge ? `(${group.badge})` : ''}</td>
                  <td className="px-4 py-3">{group.login}</td>
                  <td className="px-4 py-3">{group.active ? 'Oui' : 'Non'}</td>
                  <td className="px-4 py-3">{group.paid_until ? new Date(group.paid_until).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => void editGroupIdentity(group)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">Modifier</button>
                      <button onClick={() => void toggleActive(group)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">{group.active ? 'Désactiver' : 'Activer'}</button>
                      <button onClick={() => void addCustomDays(group)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">+ jours</button>
                      <button onClick={() => void setUnlimited(group)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">Illimité</button>
                      <button onClick={() => void removeGroup(group)} className="h-10 rounded-2xl border border-rose-300/30 bg-rose-500/12 px-3 text-sm text-rose-100 hover:bg-rose-500/22">Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
    </div>
  )
}
