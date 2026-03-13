'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  deleteTenantGroup,
  exportGroupCatalogItems,
  importGroupItemsToAdminObjects,
  getTenantGroup,
  resetTenantGroupData,
  updateTenantGroup,
  type ExportableGroupItem,
  type TenantGroup,
} from '@/lib/tenantAuthApi'
import { getTenantSession } from '@/lib/tenantSession'
import { copyToClipboard, generatePassword } from '@/lib/utils/password'
import { toast } from 'sonner'
import { ROLE_ACCESS_OPTIONS, type GroupRoleDefinition } from '@/lib/types/groupRoles'
import { GroupMembersGradesSection } from './ui/GroupMembersGradesSection'
import { PageHeader } from '@/components/PageHeader'

type EditableExportItem = ExportableGroupItem & { selected: boolean }

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
  const [exportItems, setExportItems] = useState<EditableExportItem[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [passwordDraft, setPasswordDraft] = useState('')
  const [memberPasswordDraft, setMemberPasswordDraft] = useState('')
  const [rolesDraft, setRolesDraft] = useState<GroupRoleDefinition[]>([])

  const refresh = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    try {
      const groupRow = await getTenantGroup(groupId)
      setGroup(groupRow)
      setPasswordDraft(groupRow.password || '')
      setMemberPasswordDraft(groupRow.password_member || '')
      setRolesDraft((groupRow.roles && groupRow.roles.length > 0) ? groupRow.roles : [
        { key: 'chef', name: 'Admin', password: groupRow.password || '', allowedPrefixes: ['/'] },
        { key: 'member', name: 'Membre', password: groupRow.password_member || '', allowedPrefixes: ['/tablette', '/finance/depense', '/depenses', '/activites'] },
      ].filter((role) => role.password))
      setError(null)

      try {
        const catalogRows = await exportGroupCatalogItems(groupId)
        setExportItems(catalogRows.map((row) => ({ ...row, selected: true })))
      } catch (catalogError: unknown) {
        setExportItems([])
        const message = catalogError instanceof Error ? catalogError.message : 'Impossible de charger les items du groupe.'
        setError(message)
      }
    } catch (e: unknown) {
      setGroup(null)
      setExportItems([])
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


  async function importToAdminObjects() {
    if (!group) return
    const selectedItems = exportItems.filter((item) => item.selected).map((item) => ({
      id: item.id,
      name: item.name.trim(),
      category: item.category.trim(),
      item_type: item.item_type,
      buy_price: Math.max(0, Number(item.buy_price) || 0),
      stock: Math.max(0, Math.floor(Number(item.stock) || 0)),
      image_url: item.image_url || null,
      description: item.description || null,
    })).filter((item) => item.name.length > 0)

    if (selectedItems.length === 0) {
      setError('Sélectionne au moins un item à ajouter dans Objets admin.')
      return
    }

    try {
      setBusy(true)
      setError(null)
      const result = await importGroupItemsToAdminObjects(group.id, selectedItems)
      toast.success(`Objets admin mis à jour: ${result.inserted} ajoutés, ${result.updated} fusionnés.`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import vers Objets admin impossible.')
    } finally {
      setBusy(false)
    }
  }


  function updateRole(index: number, patch: Partial<GroupRoleDefinition>) {
    setRolesDraft((prev) => prev.map((role, i) => (i === index ? { ...role, ...patch } : role)))
  }

  function toggleRoleAccess(index: number, prefix: string) {
    setRolesDraft((prev) => prev.map((role, i) => {
      if (i !== index) return role
      const exists = role.allowedPrefixes.includes(prefix)
      const nextAllowed = exists ? role.allowedPrefixes.filter((entry) => entry !== prefix) : [...role.allowedPrefixes, prefix]
      return { ...role, allowedPrefixes: nextAllowed.length > 0 ? nextAllowed : ['/tablette'] }
    }))
  }

  function addCustomRole() {
    const baseKey = `role_${Date.now()}`
    setRolesDraft((prev) => [...prev, {
      key: baseKey,
      name: 'Nouveau rôle',
      password: generatePassword({ avoidAmbiguous: true }),
      allowedPrefixes: ['/tablette'],
    }])
  }

  function removeRole(key: string) {
    if (key === 'chef' || key === 'member') return
    setRolesDraft((prev) => prev.filter((role) => role.key !== key))
  }

  async function saveRoles() {
    const sanitized = rolesDraft
      .map((role, index) => ({
        key: (role.key || `role_${index + 1}`).trim(),
        name: role.name.trim() || `Rôle ${index + 1}`,
        password: role.password.trim(),
        allowedPrefixes: role.allowedPrefixes.length > 0 ? role.allowedPrefixes : ['/tablette'],
      }))
      .filter((role) => role.password.length > 0)

    const chefRole = sanitized.find((role) => role.key === 'chef')
    const memberRole = sanitized.find((role) => role.key === 'member')

    if (!chefRole) {
      setError('Un rôle chef/admin est obligatoire.')
      return
    }

    setPasswordDraft(chefRole.password)
    setMemberPasswordDraft(memberRole?.password || '')
    await savePatch({ password: chefRole.password, password_member: memberRole?.password || null, roles: sanitized })
  }

  const selectedCount = useMemo(() => exportItems.filter((x) => x.selected).length, [exportItems])

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">Chargement du groupe…</div>
  }

  if (!group) {
    return (
      <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-sm text-rose-100">
        {error || 'Groupe introuvable.'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">Menu admin groupe</p>
        <div className="flex flex-wrap gap-2">
          <a href="#section-general" className="h-9 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs leading-9 hover:bg-white/[0.12]">Général</a>
          <a href="#section-members-grades" className="h-9 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs leading-9 hover:bg-white/[0.12]">Membres & Grades</a>
          <a href="#section-catalog-export" className="h-9 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs leading-9 hover:bg-white/[0.12]">Catalogue du groupe</a>
        </div>
      </div>

      <div id="section-general" className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeader
            title={`Gestion : ${group.name}${group.badge ? ` (${group.badge})` : ''}`}
            subtitle="Modifier, sécurité, activation et reset sans suppression."
          />
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


        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white/80">Rôles du groupe (nom, mot de passe, accès catégories)</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={addCustomRole} className="h-8 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">Ajouter un sous-rôle</button>
              <button type="button" disabled={busy} onClick={() => void saveRoles()} className="h-8 rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-3 text-xs text-cyan-50 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50">Enregistrer les rôles</button>
            </div>
          </div>

          <div className="space-y-3">
            {rolesDraft.map((role, index) => (
              <div key={role.key} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto_auto_auto] md:items-center">
                  <input
                    value={role.name}
                    onChange={(event) => updateRole(index, { name: event.target.value })}
                    className="h-9 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm"
                    placeholder="Nom du rôle"
                  />
                  <input
                    value={role.password}
                    onChange={(event) => updateRole(index, { password: event.target.value })}
                    type={showPassword ? 'text' : 'password'}
                    className="h-9 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm"
                    placeholder="Mot de passe"
                  />
                  <p className="text-xs text-white/60">Clé: <span className="font-semibold text-white/90">{role.key}</span></p>
                  <button type="button" onClick={() => updateRole(index, { password: generatePassword({ avoidAmbiguous: true }) })} className="h-9 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">Générer</button>
                  <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="h-9 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">{showPassword ? 'Masquer' : 'Voir'}</button>
                  <button type="button" onClick={() => void copyToClipboard(role.password)} className="h-9 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">Copier</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ROLE_ACCESS_OPTIONS.map((option) => {
                    const selected = role.allowedPrefixes.includes('/') || role.allowedPrefixes.includes(option.prefix)
                    return (
                      <label key={`${role.key}-${option.prefix}`} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-xs ${selected ? 'border-cyan-300/35 bg-cyan-500/20 text-cyan-100' : 'border-white/12 bg-white/[0.04] text-white/70'}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRoleAccess(index, option.prefix)}
                        />
                        {option.label}
                      </label>
                    )
                  })}
                </div>
                <div className="mt-2 flex justify-end">
                  {role.key !== 'chef' && role.key !== 'member' ? (
                    <button type="button" onClick={() => removeRole(role.key)} className="h-8 rounded-xl border border-rose-300/35 bg-rose-500/15 px-3 text-xs text-rose-100 hover:bg-rose-500/25">Supprimer</button>
                  ) : (
                    <p className="text-xs text-white/55">Rôle système non supprimable</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
              <p className="font-semibold">Accès {rolesDraft.find((role) => role.key === 'chef')?.name || 'Admin'}</p>
              <p className="mt-1 text-cyan-50">Identifiant: {group.login}</p>
              <p className="text-cyan-50">Mot de passe: {rolesDraft.find((role) => role.key === 'chef')?.password || '—'}</p>
            </div>
            <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              <p className="font-semibold">Accès {rolesDraft.find((role) => role.key === 'member')?.name || 'Membre'}</p>
              <p className="mt-1 text-emerald-50">Identifiant: {group.login}</p>
              <p className="text-emerald-50">Mot de passe: {rolesDraft.find((role) => role.key === 'member')?.password || '—'}</p>
            </div>
          </div>
        </div>


        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-1 text-sm text-white/80">
              <p>
                Expire le:{' '}
                <span className="font-semibold text-white">{group.paid_until ? new Date(group.paid_until).toLocaleString('fr-FR') : 'Jamais'}</span>
              </p>
              <p>
                Temps restant: <span className="font-semibold text-cyan-100">{formatAccessRemaining(group.paid_until)}</span>
              </p>
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

      <div id="section-members-grades">
        <GroupMembersGradesSection groupId={group.id} />
      </div>

      <div id="section-catalog-export" className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Ajouter items du groupe vers Objets admin</h2>
            <p className="text-sm text-white/70">Sélectionnez et modifiez les champs avant ajout direct dans Objets (admin).</p>
          </div>
          <button
            onClick={() => void importToAdminObjects()}
            className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm font-semibold hover:bg-white/[0.12]"
          >
            Ajouter dans Objets admin ({selectedCount})
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-white/[0.04] text-white/70">
              <tr>
                <th className="px-3 py-2">Exporter</th>
                <th className="px-3 py-2">Nom</th>
                <th className="px-3 py-2">Catégorie</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Image URL</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Prix</th>
                <th className="px-3 py-2">Stock</th>
              </tr>
            </thead>
            <tbody>
              {exportItems.map((row, index) => (
                <tr key={row.id} className="border-t border-white/10">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(e) => setExportItems((prev) => prev.map((it, i) => (i === index ? { ...it, selected: e.target.checked } : it)))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input value={row.name} onChange={(e) => setExportItems((prev) => prev.map((it, i) => (i === index ? { ...it, name: e.target.value } : it)))} className="h-9 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={row.category} onChange={(e) => setExportItems((prev) => prev.map((it, i) => (i === index ? { ...it, category: e.target.value } : it)))} className="h-9 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={row.item_type ?? ''} onChange={(e) => setExportItems((prev) => prev.map((it, i) => (i === index ? { ...it, item_type: e.target.value || null } : it)))} className="h-9 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={row.image_url ?? ''} onChange={(e) => setExportItems((prev) => prev.map((it, i) => (i === index ? { ...it, image_url: e.target.value || null } : it)))} className="h-9 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3" placeholder="https://..." />
                  </td>
                  <td className="px-3 py-2">
                    <input value={row.description ?? ''} onChange={(e) => setExportItems((prev) => prev.map((it, i) => (i === index ? { ...it, description: e.target.value || null } : it)))} className="h-9 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3" />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={row.buy_price}
                      onChange={(e) => setExportItems((prev) => prev.map((it, i) => (i === index ? { ...it, buy_price: Math.max(0, Number(e.target.value || 0) || 0) } : it)))}
                      className="h-9 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={row.stock}
                      onChange={(e) => setExportItems((prev) => prev.map((it, i) => (i === index ? { ...it, stock: Math.max(0, Math.floor(Number(e.target.value || 0) || 0)) } : it)))}
                      className="h-9 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3"
                    />
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
