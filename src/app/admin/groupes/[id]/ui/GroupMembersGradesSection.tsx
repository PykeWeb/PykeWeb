'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  createGroupMember,
  createGroupMemberGrade,
  deleteGroupMember,
  deleteGroupMemberGrade,
  listGroupMembersGrades,
  updateGroupMember,
  updateGroupMemberGrade,
} from '@/lib/tenantAuthApi'
import { expandAccessPrefixes, GROUP_OPERATIONS_PREFIX, normalizeRolePrefixes, ROLE_ACCESS_OPTIONS } from '@/lib/types/groupRoles'
import type { GroupMember, GroupMemberCandidate, GroupMemberRole, GroupMembersGradesPayload } from '@/lib/types/groupMembers'

type Props = {
  groupId: string
}

function applyPayload(
  setRoles: (next: GroupMemberRole[]) => void,
  setMembers: (next: GroupMember[]) => void,
  setCandidates: (next: GroupMemberCandidate[]) => void,
  payload: GroupMembersGradesPayload,
) {
  setRoles(payload.grades)
  setMembers(payload.members)
  setCandidates(payload.playerCandidates)
}

export function GroupMembersGradesSection({ groupId }: Props) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [roles, setRoles] = useState<GroupMemberRole[]>([])
  const [members, setMembers] = useState<GroupMember[]>([])
  const [playerCandidates, setPlayerCandidates] = useState<GroupMemberCandidate[]>([])

  const [newRoleName, setNewRoleName] = useState('')
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([GROUP_OPERATIONS_PREFIX])

  const [selectedPlayerName, setSelectedPlayerName] = useState('')
  const [customPlayerName, setCustomPlayerName] = useState('')
  const [newMemberIdentifier, setNewMemberIdentifier] = useState('')
  const [newMemberRoleId, setNewMemberRoleId] = useState('')

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      try {
        const payload = await listGroupMembersGrades(groupId)
        if (!alive) return
        applyPayload(setRoles, setMembers, setPlayerCandidates, payload)
        setError(null)
      } catch (e: unknown) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Impossible de charger les membres et rôles.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    void load()

    return () => {
      alive = false
    }
  }, [groupId])

  const roleOptions = useMemo(() => [{ value: '', label: 'Aucun rôle' }, ...roles.map((role) => ({ value: role.id, label: role.name }))], [roles])

  function toggleNewRolePermission(prefix: string) {
    setNewRolePermissions((prev) => {
      const expanded = expandAccessPrefixes(prev)
      const exists = expanded.includes(prefix)
      let next = exists ? prev.filter((entry) => entry !== prefix) : [...prev, prefix]
      if (prefix === GROUP_OPERATIONS_PREFIX) {
        next = next.filter((entry) => entry !== '/tablette' && entry !== '/activites')
      }
      const normalized = normalizeRolePrefixes(next)
      return normalized.length > 0 ? normalized : [GROUP_OPERATIONS_PREFIX]
    })
  }

  function updateRoleDraft(id: string, patch: Partial<GroupMemberRole>) {
    setRoles((prev) => prev.map((role) => (role.id === id ? { ...role, ...patch } : role)))
  }

  function toggleRolePermission(id: string, prefix: string) {
    setRoles((prev) => prev.map((role) => {
      if (role.id !== id) return role
      const expanded = expandAccessPrefixes(role.permissions)
      const exists = expanded.includes(prefix)
      let next = exists ? role.permissions.filter((entry) => entry !== prefix) : [...role.permissions, prefix]
      if (prefix === GROUP_OPERATIONS_PREFIX) {
        next = next.filter((entry) => entry !== '/tablette' && entry !== '/activites')
      }
      const normalized = normalizeRolePrefixes(next)
      return { ...role, permissions: normalized.length > 0 ? normalized : [GROUP_OPERATIONS_PREFIX] }
    }))
  }

  function updateMemberDraft(id: string, patch: Partial<GroupMember>) {
    setMembers((prev) => prev.map((member) => (member.id === id ? { ...member, ...patch } : member)))
  }

  async function createRole() {
    if (!newRoleName.trim()) {
      setError('Nom du rôle requis.')
      return
    }
    try {
      setBusy(true)
      const payload = await createGroupMemberGrade(groupId, {
        name: newRoleName.trim(),
        permissions: newRolePermissions,
      })
      applyPayload(setRoles, setMembers, setPlayerCandidates, payload)
      setNewRoleName('')
      setNewRolePermissions([GROUP_OPERATIONS_PREFIX])
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Création du rôle impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function saveRole(role: GroupMemberRole) {
    if (!role.name.trim()) {
      setError('Nom du rôle requis.')
      return
    }
    try {
      setBusy(true)
      const payload = await updateGroupMemberGrade(groupId, role.id, {
        name: role.name.trim(),
        permissions: role.permissions,
      })
      applyPayload(setRoles, setMembers, setPlayerCandidates, payload)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mise à jour du rôle impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function removeRole(roleId: string) {
    try {
      setBusy(true)
      const payload = await deleteGroupMemberGrade(groupId, roleId)
      applyPayload(setRoles, setMembers, setPlayerCandidates, payload)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Suppression du rôle impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function createMemberEntry() {
    const chosenName = customPlayerName.trim() || selectedPlayerName.trim()
    if (!chosenName) {
      setError('Sélectionnez ou saisissez un joueur.')
      return
    }
    try {
      setBusy(true)
      const payload = await createGroupMember(groupId, {
        player_name: chosenName,
        player_identifier: newMemberIdentifier.trim() || null,
        grade_id: newMemberRoleId || null,
      })
      applyPayload(setRoles, setMembers, setPlayerCandidates, payload)
      setSelectedPlayerName('')
      setCustomPlayerName('')
      setNewMemberIdentifier('')
      setNewMemberRoleId('')
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Création du membre impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function saveMember(member: GroupMember) {
    if (!member.player_name.trim()) {
      setError('Nom du membre requis.')
      return
    }
    try {
      setBusy(true)
      const payload = await updateGroupMember(groupId, member.id, {
        player_name: member.player_name.trim(),
        player_identifier: member.player_identifier?.trim() || null,
        grade_id: member.grade_id || null,
      })
      applyPayload(setRoles, setMembers, setPlayerCandidates, payload)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mise à jour du membre impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(memberId: string) {
    try {
      setBusy(true)
      const payload = await deleteGroupMember(groupId, memberId)
      applyPayload(setRoles, setMembers, setPlayerCandidates, payload)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Suppression du membre impossible.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">Chargement membres & rôles…</div>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow lg:p-8">
        <h2 className="text-2xl font-semibold">Membres & Rôles</h2>
        <p className="mt-1 text-sm text-white/70">Gestion dédiée au groupe courant. Chaque membre et rôle est lié au groupe sélectionné.</p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-white/80">Créer un rôle</p>
            <div className="mt-2 grid gap-2">
              <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Nom du rôle" className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
              <div className="flex flex-wrap gap-2">
                {ROLE_ACCESS_OPTIONS.map((option) => {
                  const selected = newRolePermissions.includes('/') || expandAccessPrefixes(newRolePermissions).includes(option.prefix)
                  return (
                    <label key={`new-role-${option.prefix}`} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-xs ${selected ? 'border-cyan-300/35 bg-cyan-500/20 text-cyan-100' : 'border-white/12 bg-white/[0.04] text-white/70'}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleNewRolePermission(option.prefix)} className="h-3.5 w-3.5" />
                      {option.label}
                    </label>
                  )
                })}
              </div>
              <button disabled={busy} onClick={() => void createRole()} className="h-10 rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-3 text-sm text-cyan-50 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50">Créer rôle</button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-white/80">Ajouter un membre</p>
            <div className="mt-2 grid gap-2">
              <label className="text-xs text-white/65">Sélectionner un joueur existant</label>
              <select value={selectedPlayerName} onChange={(e) => setSelectedPlayerName(e.target.value)} className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm">
                <option value="">Choisir un joueur</option>
                {playerCandidates.map((candidate) => (
                  <option key={candidate.value} value={candidate.value}>{candidate.label}</option>
                ))}
              </select>
              <input value={customPlayerName} onChange={(e) => setCustomPlayerName(e.target.value)} placeholder="Ou saisir manuellement le nom" className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
              <input value={newMemberIdentifier} onChange={(e) => setNewMemberIdentifier(e.target.value)} placeholder="Identifiant joueur (optionnel)" className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
              <select value={newMemberRoleId} onChange={(e) => setNewMemberRoleId(e.target.value)} className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm">
                {roleOptions.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button disabled={busy} onClick={() => void createMemberEntry()} className="h-10 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 text-sm text-emerald-50 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50">Créer membre</button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow lg:p-8">
        <h3 className="text-xl font-semibold">Rôles existants</h3>
        <div className="mt-3 space-y-3">
          {roles.length === 0 ? <p className="text-sm text-white/60">Aucun rôle pour ce groupe.</p> : null}
          {roles.map((role) => (
            <div key={role.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-center">
                <input value={role.name} onChange={(e) => updateRoleDraft(role.id, { name: e.target.value })} className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
                <button disabled={busy} onClick={() => void saveRole(role)} className="h-10 rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-3 text-sm text-cyan-50 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50">Enregistrer</button>
                <button disabled={busy} onClick={() => void removeRole(role.id)} className="h-10 rounded-xl border border-rose-300/35 bg-rose-500/15 px-3 text-sm text-rose-100 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50">Supprimer</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ROLE_ACCESS_OPTIONS.map((option) => {
                  const selected = role.permissions.includes('/') || expandAccessPrefixes(role.permissions).includes(option.prefix)
                  return (
                    <label key={`${role.id}-${option.prefix}`} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-xs ${selected ? 'border-cyan-300/35 bg-cyan-500/20 text-cyan-100' : 'border-white/12 bg-white/[0.04] text-white/70'}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleRolePermission(role.id, option.prefix)} className="h-3.5 w-3.5" />
                      {option.label}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow lg:p-8">
        <h3 className="text-xl font-semibold">Membres existants</h3>
        <div className="mt-3 space-y-3">
          {members.length === 0 ? <p className="text-sm text-white/60">Aucun membre pour ce groupe.</p> : null}
          {members.map((member) => (
            <div key={member.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_auto_auto] md:items-center">
                <input value={member.player_name} onChange={(e) => updateMemberDraft(member.id, { player_name: e.target.value })} className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm" placeholder="Nom du membre" />
                <input value={member.player_identifier ?? ''} onChange={(e) => updateMemberDraft(member.id, { player_identifier: e.target.value || null })} className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm" placeholder="Identifiant" />
                <select value={member.grade_id ?? ''} onChange={(e) => updateMemberDraft(member.id, { grade_id: e.target.value || null })} className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm">
                  {roleOptions.map((opt) => (
                    <option key={`${member.id}-${opt.value || 'none'}`} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button disabled={busy} onClick={() => void saveMember(member)} className="h-10 rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-3 text-sm text-cyan-50 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50">Enregistrer</button>
                <button disabled={busy} onClick={() => void removeMember(member.id)} className="h-10 rounded-xl border border-rose-300/35 bg-rose-500/15 px-3 text-sm text-rose-100 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50">Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
    </div>
  )
}
