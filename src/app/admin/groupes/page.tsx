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
      setGroups(await listTenantGroups())
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Erreur chargement groupes')
    }
  }

  useEffect(() => {
    const session = getTenantSession()
    if (!session?.isAdmin) {
      window.location.href = '/'
      return
    }
    refresh()
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <h1 className="text-xl font-bold">Admin • Gestion des groupes</h1>
        <p className="mt-1 text-sm text-white/70">
          Créer, désactiver, prolonger (paiement 7 jours), supprimer et gérer les identifiants.
        </p>

        <form
          className="mt-4 grid gap-2 md:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault()
            void addGroup()
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom groupe"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          />
          <select
            value={newBadge}
            onChange={(e) => setNewBadge(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            <option value="PF">PF</option>
            <option value="Gang">Gang</option>
            <option value="Organisation">Organisation</option>
            <option value="Famille">Famille</option>
            <option value="Indépendant">Indépendant</option>
          </select>
          <input
            value={newLogin}
            onChange={(e) => setNewLogin(e.target.value)}
            placeholder="Identifiant"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mot de passe"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Création…' : 'Créer'}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <p className="text-white/60">Groupes actifs</p>
            <p className="text-lg font-semibold">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <p className="text-white/60">Groupes expirés</p>
            <p className="text-lg font-semibold">{expiredCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <p className="text-white/60">Groupes illimités</p>
            <p className="text-lg font-semibold">{unlimitedCount}</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-3 py-2 text-left">Groupe</th>
                <th className="px-3 py-2 text-left">Identifiant</th>
                <th className="px-3 py-2 text-left">Actif</th>
                <th className="px-3 py-2 text-left">Payé jusqu’au</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-t border-white/10">
                  <td className="px-3 py-2">
                    {g.name} <span className="text-white/60">({g.badge || 'GROUPE'})</span>
                  </td>
                  <td className="px-3 py-2">{g.login}</td>
                  <td className="px-3 py-2">{g.active ? 'Oui' : 'Non'}</td>
                  <td className="px-3 py-2">{g.paid_until ? new Date(g.paid_until).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={async () => {
                          await editGroupIdentity(g)
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={async () => {
                          await updateTenantGroup(g.id, { active: !g.active })
                          refresh()
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                      >
                        {g.active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        onClick={async () => {
                          await addCustomDays(g)
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                      >
                        + jours
                      </button>
                      <button
                        onClick={async () => {
                          await setUnlimited(g)
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                      >
                        Illimité
                      </button>
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Supprimer ${g.name} ?`)) return
                          await deleteTenantGroup(g.id)
                          refresh()
                        }}
                        className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-rose-200"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-white/60">
                    Aucun groupe.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
          <p className="font-semibold">Idées utiles à ajouter ensuite</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-white/70">
            <li>Dernière connexion par groupe.</li>
            <li>Compteur d'objets / armes / transactions par groupe.</li>
            <li>Export CSV des groupes et statuts de paiement.</li>
            <li>Historique admin (qui a modifié quoi).</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
