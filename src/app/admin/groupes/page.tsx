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
                          await updateTenantGroup(g.id, { active: !g.active })
                          refresh()
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                      >
                        {g.active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        onClick={async () => {
                          const next = new Date(
                            Math.max(Date.now(), new Date(g.paid_until || Date.now()).getTime()) + 7 * 24 * 60 * 60 * 1000,
                          )
                          await updateTenantGroup(g.id, { paid_until: next.toISOString() })
                          refresh()
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                      >
                        +7 jours
                      </button>
                      <button
                        onClick={async () => {
                          const pass = window.prompt('Nouveau mot de passe :', g.password || '')
                          if (pass === null) return
                          await updateTenantGroup(g.id, { password: pass })
                          refresh()
                        }}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                      >
                        MDP
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
      </div>
    </div>
  )
}
