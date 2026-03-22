'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { deleteTenantGroup, getTenantGroup, resetTenantGroupData, updateTenantGroup, type TenantGroup } from '@/lib/tenantAuthApi'
import { getTenantSession } from '@/lib/tenantSession'
import { toast } from 'sonner'
import { GroupMembersGradesSection } from './ui/GroupMembersGradesSection'
import { PageHeader } from '@/components/PageHeader'

function formatAccessRemaining(paidUntil: string | null) {
  if (!paidUntil) return 'Accès illimité'
  const paidUntilDate = new Date(paidUntil)
  if (Number.isNaN(paidUntilDate.getTime())) return 'Expiration invalide'

  const remainingMs = paidUntilDate.getTime() - Date.now()
  if (remainingMs <= 0) return 'Accès expiré'

  const totalMinutes = Math.floor(remainingMs / (1000 * 60))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}j ${hours}h restantes`
  if (hours > 0) return `${hours}h ${minutes}m restantes`
  return `${minutes}m restantes`
}

export default function AdminGroupDetailsPage() {
  const params = useParams<{ id: string }>()
  const groupId = params?.id

  const [group, setGroup] = useState<TenantGroup | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    try {
      const groupRow = await getTenantGroup(groupId)
      setGroup(groupRow)
      setError(null)
    } catch (e: unknown) {
      setGroup(null)
      setError(e instanceof Error ? e.message : 'Impossible de charger le groupe.')
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    const session = getTenantSession()
    if (!(session?.isAdmin || session?.groupId === 'admin')) {
      window.location.href = '/'
      return
    }
    void refresh()
  }, [refresh])

  async function savePatch(patch: Partial<TenantGroup>) {
    if (!group) return
    try {
      setBusy(true)
      await updateTenantGroup(group.id, patch)
      await refresh()
      toast.success('Groupe mis à jour.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Modification impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function addDays() {
    if (!group) return
    const rawDays = window.prompt('Ajouter combien de jours ?', '7')
    if (rawDays === null) return
    const days = Number(rawDays)
    if (!Number.isFinite(days) || days <= 0) {
      setError('Nombre de jours invalide.')
      return
    }
    const baseTs = group.paid_until ? new Date(group.paid_until).getTime() : Date.now()
    const next = new Date(Math.max(Date.now(), baseTs) + days * 24 * 60 * 60 * 1000)
    await savePatch({ paid_until: next.toISOString() })
  }

  async function resetGroupData() {
    if (!group) return
    if (!window.confirm(`Réinitialiser toutes les données du groupe ${group.name} sans supprimer le compte ?`)) return
    try {
      setBusy(true)
      await resetTenantGroupData(group.id)
      await refresh()
      toast.success('Le groupe a été remis à neuf.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reset impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteGroup() {
    if (!group) return
    if (!window.confirm(`Supprimer définitivement le groupe ${group.name} ?`)) return
    try {
      setBusy(true)
      await deleteTenantGroup(group.id)
      window.location.href = '/admin/groupes'
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Suppression impossible.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">Chargement du groupe…</div>
  }

  if (!group) {
    return <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-sm text-rose-100">{error || 'Groupe introuvable.'}</div>
  }

  return (
    <div className="space-y-6">
      <div id="section-general" className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeader title={`Gestion : ${group.name}${group.badge ? ` (${group.badge})` : ''}`} subtitle="Général du groupe (nom, badge, identifiant, expiration, actions)." size="compact" />
          <Link href="/admin/groupes" className="inline-flex h-10 items-center rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm font-semibold hover:bg-white/[0.12]">Retour</Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-white/70">Nom</span>
            <input defaultValue={group.name} onBlur={(e) => void savePatch({ name: e.target.value.trim() || group.name })} className="h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-white/70">Badge</span>
            <input defaultValue={group.badge || ''} onBlur={(e) => void savePatch({ badge: e.target.value.trim() || null })} className="h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-white/70">Identifiant</span>
            <input defaultValue={group.login} onBlur={(e) => void savePatch({ login: e.target.value.trim() || group.login })} className="h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" />
          </label>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-1 text-sm text-white/80">
              <p>Expire le: <span className="font-semibold text-white">{group.paid_until ? new Date(group.paid_until).toLocaleString('fr-FR') : 'Jamais'}</span></p>
              <p>Temps restant: <span className="font-semibold text-cyan-100">{formatAccessRemaining(group.paid_until)}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => void addDays()} className="h-8 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">+ Jours</button>
              <button disabled={busy} onClick={() => void savePatch({ paid_until: null })} className="h-8 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">Illimité</button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => void savePatch({ active: !group.active })} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm hover:bg-white/[0.12]">{group.active ? 'Désactiver' : 'Activer'}</button>
          <button disabled={busy} onClick={() => void resetGroupData()} className="h-10 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 text-sm text-amber-100 hover:bg-amber-500/20">Reset groupe</button>
          <button disabled={busy} onClick={() => void deleteGroup()} className="h-10 rounded-2xl border border-rose-300/30 bg-rose-500/12 px-4 text-sm text-rose-100 hover:bg-rose-500/22">Supprimer groupe</button>
        </div>
      </div>

      <GroupMembersGradesSection groupId={group.id} />

      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
    </div>
  )
}
