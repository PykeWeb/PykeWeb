'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createTenantGroup,
  deleteTenantGroup,
  listTenantGroups,
  updateTenantGroup,
  type TenantGroup,
} from '@/lib/tenantAuthApi'
import { getTenantSession } from '@/lib/tenantSession'
import { copyToClipboard, generatePassword } from '@/lib/utils/password'

type PasswordModal =
  | { type: 'group'; group: TenantGroup }
  | { type: 'admin'; group: TenantGroup }
  | null

type GroupEditModal = TenantGroup | null

function PasswordField({ value }: { value: string }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-[90px] rounded-xl border border-white/12 bg-white/[0.05] px-3 py-1 text-xs">
        {visible ? value : '••••••••'}
      </span>
      <button onClick={() => setVisible((v) => !v)} className="h-8 rounded-xl border border-white/12 bg-white/[0.06] px-2 text-xs hover:bg-white/[0.12]">
        {visible ? '🙈' : '👁️'}
      </button>
      <button onClick={() => void copyToClipboard(value)} className="h-8 rounded-xl border border-white/12 bg-white/[0.06] px-2 text-xs hover:bg-white/[0.12]">📋</button>
    </div>
  )
}

function GroupEditIdentityModal({ group, onClose, onSaved }: { group: GroupEditModal; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [badge, setBadge] = useState('PF')
  const [login, setLogin] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!group) return
    setName(group.name)
    setBadge(group.badge || 'PF')
    setLogin(group.login)
    setError(null)
  }, [group])

  if (!group) return null

  async function save() {
    if (!group) return
    try {
      await updateTenantGroup(group.id, { name: name.trim(), badge: badge.trim(), login: login.trim() })
      await onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Impossible de modifier le groupe.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0f1625]/95 p-5 shadow-glow" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold">Modifier groupe</h2>
        <div className="mt-4 grid gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom groupe" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm" />
          <select value={badge} onChange={(e) => setBadge(e.target.value)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm">
            <option value="PF">PF</option><option value="Gang">Gang</option><option value="Organisation">Organisation</option><option value="Famille">Famille</option><option value="Indépendant">Indépendant</option>
          </select>
          <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Identifiant" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm" />
        </div>
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm">Annuler</button>
          <button onClick={() => void save()} className="h-10 rounded-2xl border border-white/15 bg-white/[0.09] px-4 text-sm font-semibold">Enregistrer</button>
        </div>
      </div>
    </div>
  )
}

function PasswordChangeModal({ state, onClose, onSaved }: { state: PasswordModal; onClose: () => void; onSaved: () => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state) return
    const generated = generatePassword({ length: 16, avoidAmbiguous: true })
    setPassword(generated)
    setConfirm(generated)
    setError(null)
  }, [state])

  if (!state) return null

  async function save() {
    if (!state) return
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (!password.trim()) {
      setError('Mot de passe requis.')
      return
    }
    try {
      await updateTenantGroup(state.group.id, { password })
      await onSaved()
      onClose()
      alert('Mot de passe mis à jour.')
    } catch (e: any) {
      setError(e?.message || 'Impossible de mettre à jour le mot de passe.')
    }
  }

  function regenerate() {
    const generated = generatePassword({ length: 16, avoidAmbiguous: true })
    setPassword(generated)
    setConfirm(generated)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0f1625]/95 p-5 shadow-glow" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold">{state.type === 'admin' ? 'Modifier mot de passe Admin' : 'Modifier mot de passe'}</h2>
        <p className="mt-1 text-sm text-white/60">{state.group.name}</p>

        <div className="mt-4 grid gap-2">
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nouveau mot de passe" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm" />
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmer" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm" />
          <div className="flex gap-2">
            <button onClick={regenerate} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm">Régénérer</button>
            <button onClick={() => void copyToClipboard(password)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm">Copier</button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm">Annuler</button>
          <button onClick={() => void save()} className="h-10 rounded-2xl border border-white/15 bg-white/[0.09] px-4 text-sm font-semibold">Enregistrer</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<TenantGroup[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBadge, setNewBadge] = useState('PF')
  const [newLogin, setNewLogin] = useState('')
  const [newPassword, setNewPassword] = useState(generatePassword({ avoidAmbiguous: true }))
  const [passwordModal, setPasswordModal] = useState<PasswordModal>(null)
  const [editModal, setEditModal] = useState<GroupEditModal>(null)

  const now = Date.now()
  const activeCount = groups.filter((g) => g.active).length
  const expiredCount = groups.filter((g) => g.paid_until && new Date(g.paid_until).getTime() < now).length
  const unlimitedCount = groups.filter((g) => !g.paid_until).length
  const adminGroup = useMemo(
    () => groups.find((g) => g.login.toLowerCase() === 'admin' || (g.badge || '').toUpperCase() === 'ADMIN') || null,
    [groups]
  )

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
      setNewPassword(generatePassword({ avoidAmbiguous: true }))
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Impossible de créer le groupe.')
    } finally {
      setIsSubmitting(false)
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Admin • Gestion des groupes</h1>
            <p className="mt-2 text-lg text-white/70">Créer, désactiver, prolonger, supprimer et gérer les identifiants.</p>
          </div>
          <button
            onClick={() => adminGroup && setPasswordModal({ type: 'admin', group: adminGroup })}
            className="h-10 rounded-2xl border border-white/15 bg-white/[0.09] px-4 text-sm font-semibold hover:bg-white/[0.14]"
            disabled={!adminGroup}
          >
            Sécurité Admin
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-6">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom groupe" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm" />
          <select value={newBadge} onChange={(e) => setNewBadge(e.target.value)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm">
            <option value="PF">PF</option><option value="Gang">Gang</option><option value="Organisation">Organisation</option><option value="Famille">Famille</option><option value="Indépendant">Indépendant</option>
          </select>
          <input value={newLogin} onChange={(e) => setNewLogin(e.target.value)} placeholder="Identifiant" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm" />
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="Mot de passe" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm" />
          <button onClick={() => setNewPassword(generatePassword({ avoidAmbiguous: true }))} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">Générer</button>
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
                <th className="px-4 py-3">Mot de passe</th>
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
                  <td className="px-4 py-3"><PasswordField value={group.password || ''} /></td>
                  <td className="px-4 py-3">{group.active ? 'Oui' : 'Non'}</td>
                  <td className="px-4 py-3">{group.paid_until ? new Date(group.paid_until).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditModal(group)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">Modifier</button>
                      <button onClick={() => setPasswordModal({ type: 'group', group })} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">Mdp</button>
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

      <GroupEditIdentityModal group={editModal} onClose={() => setEditModal(null)} onSaved={refresh} />
      <PasswordChangeModal state={passwordModal} onClose={() => setPasswordModal(null)} onSaved={refresh} />
    </div>
  )
}
