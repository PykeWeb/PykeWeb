'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createTenantGroup, listTenantGroups, type TenantGroup } from '@/lib/tenantAuthApi'
import { getTenantSession } from '@/lib/tenantSession'
import { copyToClipboard, generatePassword } from '@/lib/utils/password'
import { GlassSelect } from '@/components/ui/GlassSelect'

type CreateGroupModalProps = {
  open: boolean
  submitting: boolean
  onClose: () => void
  onCreate: (payload: { name: string; badge: string; login: string; password: string; password_member: string }) => Promise<void>
}

function CreateGroupModal({ open, onClose, onCreate, submitting }: CreateGroupModalProps) {
  const [name, setName] = useState('')
  const [badge, setBadge] = useState('PF')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(true)
  const [memberPassword, setMemberPassword] = useState('')
  const [showMemberPassword, setShowMemberPassword] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setBadge('PF')
    setLogin('')
    const generatedChef = generatePassword({ avoidAmbiguous: true })
    const generatedMember = generatePassword({ avoidAmbiguous: true })
    setPassword(generatedChef)
    setMemberPassword(generatedMember)
    setShowPassword(true)
    setShowMemberPassword(true)
    setError(null)
  }, [open])

  if (!open) return null

  async function submit() {
    if (!name.trim() || !login.trim() || !password.trim() || !memberPassword.trim()) {
      setError('Nom, identifiant et mots de passe chef/membre sont obligatoires.')
      return
    }
    try {
      setError(null)
      await onCreate({ name: name.trim(), badge, login: login.trim(), password, password_member: memberPassword })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Impossible de créer le groupe.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0f1625]/95 p-5 shadow-glow" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold">Créer un groupe</h2>
        <p className="mt-1 text-sm text-white/60">Ajoutez un nouveau groupe sans quitter la page.</p>

        <div className="mt-4 grid gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du groupe" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm" />
          <GlassSelect value={badge} onChange={setBadge} options={[{value:'PF',label:'PF'},{value:'Gang',label:'Gang'},{value:'Organisation',label:'Organisation'},{value:'Famille',label:'Famille'},{value:'Indépendant',label:'Indépendant'}]} />
          <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Identifiant" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm" />
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              placeholder="Mot de passe"
              className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm"
            />
            <button onClick={() => setShowPassword((v) => !v)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">{showPassword ? 'Masquer' : 'Voir'}</button>
            <button onClick={() => setPassword(generatePassword({ avoidAmbiguous: true }))} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">Générer</button>
            <button onClick={() => void copyToClipboard(password)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">Copier</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <input
              value={memberPassword}
              onChange={(e) => setMemberPassword(e.target.value)}
              type={showMemberPassword ? 'text' : 'password'}
              placeholder="Mot de passe membre"
              className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm"
            />
            <button onClick={() => setShowMemberPassword((v) => !v)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">{showMemberPassword ? 'Masquer' : 'Voir'}</button>
            <button onClick={() => setMemberPassword(generatePassword({ avoidAmbiguous: true }))} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">Générer</button>
            <button onClick={() => void copyToClipboard(memberPassword)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">Copier</button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm">Annuler</button>
          <button disabled={submitting} onClick={() => void submit()} className="h-10 rounded-2xl border border-white/15 bg-white/[0.09] px-4 text-sm font-semibold">{submitting ? 'Création…' : 'Créer'}</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<TenantGroup[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const now = Date.now()
  const activeCount = groups.filter((g) => g.active).length
  const expiredCount = groups.filter((g) => g.paid_until && new Date(g.paid_until).getTime() < now).length
  const unlimitedCount = groups.filter((g) => !g.paid_until).length

  async function refresh() {
    try {
      const tenantGroups = await listTenantGroups()
      setGroups(tenantGroups)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur chargement admin')
    }
  }

  useEffect(() => {
    const session = getTenantSession()
    if (!(session?.isAdmin || session?.groupId === 'admin')) {
      window.location.href = '/'
      return
    }
    void refresh()
  }, [])

  async function addGroup(payload: { name: string; badge: string; login: string; password: string; password_member: string }) {
    setIsSubmitting(true)
    setError(null)

    try {
      const paidUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      await createTenantGroup({
        name: payload.name,
        badge: payload.badge,
        login: payload.login,
        password: payload.password,
        password_member: payload.password_member,
        active: true,
        paid_until: paidUntil,
      })
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Impossible de créer le groupe.')
      throw e
    } finally {
      setIsSubmitting(false)
    }
  }

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [groups]
  )

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-7xl rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow lg:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Admin • Gestion des groupes</h1>
            <p className="mt-2 text-lg text-white/70">Un bouton unique “Gérer” par groupe pour accéder à la fiche complète.</p>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm font-semibold hover:bg-white/[0.12]"
          >
            Créer
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"><p className="text-sm text-white/60">Groupes actifs</p><p className="text-4xl font-semibold">{activeCount}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"><p className="text-sm text-white/60">Groupes expirés</p><p className="text-4xl font-semibold">{expiredCount}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"><p className="text-sm text-white/60">Groupes illimités</p><p className="text-4xl font-semibold">{unlimitedCount}</p></div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-white/[0.04] text-white/70">
                <tr>
                  <th className="px-4 py-3">Groupe</th>
                  <th className="px-4 py-3">Identifiant</th>
                  <th className="px-4 py-3">Actif</th>
                  <th className="px-4 py-3">Payé jusqu’au</th>
                  <th className="px-4 py-3 text-right">Gestion</th>
                </tr>
              </thead>
              <tbody>
                {sortedGroups.map((group) => (
                  <tr key={group.id} className="border-t border-white/10 align-top">
                    <td className="px-4 py-3 font-medium">{group.name} {group.badge ? `(${group.badge})` : ''}</td>
                    <td className="px-4 py-3">{group.login}</td>
                    <td className="px-4 py-3">{group.active ? 'Oui' : 'Non'}</td>
                    <td className="px-4 py-3">{group.paid_until ? new Date(group.paid_until).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/groupes/${group.id}`} className="inline-flex h-10 items-center rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm font-semibold hover:bg-white/[0.12]">
                        Gérer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}

      <CreateGroupModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} onCreate={addGroup} submitting={isSubmitting} />
    </div>
  )
}
