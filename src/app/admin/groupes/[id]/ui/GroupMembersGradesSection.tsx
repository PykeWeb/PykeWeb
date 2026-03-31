'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, Eye, EyeOff, KeyRound, RefreshCw, Save, Shield, Trash2, UserCircle2 } from 'lucide-react'
import {
  createGroupMember,
  createGroupMemberGrade,
  deleteGroupMember,
  deleteGroupMemberGrade,
  listGroupMembersGrades,
  updateGroupMember,
  updateGroupMemberGrade,
} from '@/lib/tenantAuthApi'
import { expandAccessPrefixes, normalizeRolePrefixes, ROLE_ACCESS_OPTIONS } from '@/lib/types/groupRoles'
import type { GroupMember, GroupMemberCandidate, GroupMemberRole, GroupMembersGradesPayload } from '@/lib/types/groupMembers'
import { copyToClipboard, generatePassword } from '@/lib/utils/password'

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
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>(['/tablette'])

  const [selectedPlayerName, setSelectedPlayerName] = useState('')
  const [customPlayerName, setCustomPlayerName] = useState('')
  const [newMemberIdentifier, setNewMemberIdentifier] = useState('')
  const [newMemberPassword, setNewMemberPassword] = useState('')
  const [newMemberPasswordVisible, setNewMemberPasswordVisible] = useState(false)
  const [newMemberIsAdmin, setNewMemberIsAdmin] = useState(false)
  const [newMemberRoleId, setNewMemberRoleId] = useState('')
  const [memberPasswordVisible, setMemberPasswordVisible] = useState<Record<string, boolean>>({})
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

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
  const groupMemberNameOptions = useMemo(() => {
    const fromMembers = members.map((member) => ({
      value: String(member.player_name || '').trim(),
      label: String(member.player_name || '').trim(),
    })).filter((entry) => entry.value)

    return [...fromMembers, ...playerCandidates]
      .filter((entry) => entry.value.trim())
      .reduce<Array<{ value: string; label: string }>>((acc, entry) => {
      if (acc.some((row) => row.value.toLowerCase() === entry.value.toLowerCase())) return acc
      return [...acc, { value: entry.value, label: entry.label || entry.value }]
    }, [])
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [members, playerCandidates])
  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase()
    if (!query) return members
    return members.filter((member) => {
      const name = String(member.player_name || '').toLowerCase()
      const identifier = String(member.player_identifier || '').toLowerCase()
      return name.includes(query) || identifier.includes(query)
    })
  }, [members, memberSearch])
  const selectedMember = useMemo(
    () => filteredMembers.find((member) => member.id === selectedMemberId) ?? filteredMembers[0] ?? null,
    [filteredMembers, selectedMemberId]
  )

  useEffect(() => {
    if (!filteredMembers.length) {
      setSelectedMemberId(null)
      return
    }
    if (!selectedMemberId || !filteredMembers.some((member) => member.id === selectedMemberId)) {
      setSelectedMemberId(filteredMembers[0].id)
    }
  }, [filteredMembers, selectedMemberId])

  function toggleNewRolePermission(prefix: string) {
    setNewRolePermissions((prev) => {
      const expanded = expandAccessPrefixes(prev)
      const exists = expanded.includes(prefix)
      let next = exists ? prev.filter((entry) => entry !== prefix) : [...prev, prefix]
      const normalized = normalizeRolePrefixes(next)
      return normalized.length > 0 ? normalized : ['/tablette']
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
      const normalized = normalizeRolePrefixes(next)
      return { ...role, permissions: normalized.length > 0 ? normalized : ['/tablette'] }
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
      setNewRolePermissions(['/tablette'])
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
    const identifier = newMemberIdentifier.trim()
    const password = newMemberPassword.trim()

    if (!identifier) {
      setError('Identifiant requis.')
      return
    }

    if (!password) {
      setError('Mot de passe requis.')
      return
    }

    const resolvedName = chosenName || identifier
    try {
      setBusy(true)
      const payload = await createGroupMember(groupId, {
        player_name: resolvedName,
        player_identifier: identifier,
        password,
        is_admin: newMemberIsAdmin,
        grade_id: newMemberRoleId || null,
      })
      applyPayload(setRoles, setMembers, setPlayerCandidates, payload)
      setSelectedPlayerName('')
      setCustomPlayerName('')
      setNewMemberIdentifier('')
      setNewMemberPassword('')
      setNewMemberPasswordVisible(false)
      setNewMemberIsAdmin(false)
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
        password: member.password?.trim() || null,
        is_admin: member.is_admin,
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
              <label className="text-xs text-white/65">Sélectionner un membre existant du groupe</label>
              <select value={selectedPlayerName} onChange={(e) => setSelectedPlayerName(e.target.value)} className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm">
                <option value="">Choisir un joueur</option>
                {groupMemberNameOptions.map((candidate) => (
                  <option key={candidate.value} value={candidate.value}>{candidate.label}</option>
                ))}
              </select>
              <input value={customPlayerName} onChange={(e) => setCustomPlayerName(e.target.value)} placeholder="Nom joueur (optionnel)" className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
              <input value={newMemberIdentifier} onChange={(e) => setNewMemberIdentifier(e.target.value)} placeholder="Identifiant (requis)" className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                <input value={newMemberPassword} onChange={(e) => setNewMemberPassword(e.target.value)} type={newMemberPasswordVisible ? 'text' : 'password'} placeholder="Mot de passe (requis)" className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
                <button type="button" onClick={() => setNewMemberPasswordVisible((v) => !v)} className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">{newMemberPasswordVisible ? 'Masquer' : 'Voir'}</button>
                <button type="button" onClick={() => setNewMemberPassword(generatePassword({ avoidAmbiguous: true }))} className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">Générer</button>
                <button type="button" onClick={() => void copyToClipboard(newMemberPassword)} className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">Copier</button>
              </div>
              <p className="text-[11px] text-white/55">Si le nom joueur est vide, l’identifiant sera utilisé comme nom.</p>
              <label className="inline-flex items-center gap-2 text-xs text-white/70">
                <input type="checkbox" checked={newMemberIsAdmin} onChange={(e) => setNewMemberIsAdmin(e.target.checked)} className="h-4 w-4" />
                Créer un membre admin (accès total)
              </label>
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
        <h3 className="text-xl font-semibold text-center">Membres existants</h3>
        <p className="mt-1 text-sm text-white/70 text-center">Liste rapide des membres. Clique un nom pour ouvrir ses détails et permissions.</p>
        <div className="mx-auto mt-4 w-full max-w-5xl space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Rechercher un membre (nom ou identifiant)"
                className="h-10 w-full rounded-xl border border-white/20 bg-black/25 px-3 text-sm text-white placeholder:text-white/45 focus:border-cyan-300/50 focus:outline-none"
              />
              <p className="text-xs text-white/65">{filteredMembers.length} / {members.length} membre(s)</p>
            </div>
          </div>
          {members.length === 0 ? <p className="text-sm text-white/60">Aucun membre pour ce groupe.</p> : null}
          {members.length > 0 && filteredMembers.length === 0 ? <p className="text-sm text-white/60">Aucun membre ne correspond à la recherche.</p> : null}
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex max-h-[220px] flex-wrap gap-2 overflow-y-auto pr-1">
              {filteredMembers.map((member) => (
                <div key={`chip-${member.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => setSelectedMemberId(member.id)}
                    className={`rounded-full px-3 py-1 text-xs ${selectedMember?.id === member.id ? 'bg-cyan-500/25 text-cyan-100' : 'text-white/85 hover:bg-white/10'}`}
                  >
                    {member.player_name || member.player_identifier || 'Membre'}
                  </button>
                  <button
                    type="button"
                    title="Copier accès"
                    onClick={() => {
                      const identifier = (member.player_identifier || '').trim()
                      const password = (member.password || '').trim()
                      const content = [
                        'Voici tes identifiants pour la tablette du groupe :',
                        'https://pykestock-ten.vercel.app/',
                        '',
                        `Identifiant: ${identifier || '—'}`,
                        `Mot de passe: ${password || '—'}`,
                        '',
                        'Tu peux modifier ton mot de passe avec le bouton "Changer mot de passe" dans le dashboard, en dessous de Déconnexion.',
                      ].join('\n')
                      void copyToClipboard(content)
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/85 hover:bg-white/20"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {selectedMember ? (
            <div key={selectedMember.id} className="rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/70 via-slate-800/55 to-slate-900/75 p-4 shadow-[0_10px_35px_rgba(0,0,0,0.35)] md:p-5">
              <div className="flex flex-wrap items-start justify-center gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-200/30 bg-cyan-500/15 text-cyan-100">
                    <UserCircle2 className="h-6 w-6" />
                  </span>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-white/60">Nom du membre</label>
                    <input value={selectedMember.player_name} onChange={(e) => updateMemberDraft(selectedMember.id, { player_name: e.target.value })} className="mt-1 h-10 w-full min-w-[220px] rounded-xl border border-white/20 bg-black/25 px-3 text-sm text-white placeholder:text-white/45 focus:border-cyan-300/50 focus:outline-none" placeholder="Nom du membre" />
                  </div>
                </div>
                <div className="w-full max-w-[300px]">
                  <label className="text-[11px] uppercase tracking-wide text-white/60">Identifiant</label>
                  <input value={selectedMember.player_identifier ?? ''} onChange={(e) => updateMemberDraft(selectedMember.id, { player_identifier: e.target.value || null })} className="mt-1 h-10 w-full rounded-xl border border-white/20 bg-black/25 px-3 text-sm text-white placeholder:text-white/45 focus:border-cyan-300/50 focus:outline-none" placeholder="Identifiant membre" />
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/65">
                    <KeyRound className="h-3.5 w-3.5" />
                    Mot de passe
                  </label>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                    <input
                      value={selectedMember.password ?? ''}
                      onChange={(e) => updateMemberDraft(selectedMember.id, { password: e.target.value || null })}
                      type={memberPasswordVisible[selectedMember.id] ? 'text' : 'password'}
                      className="h-10 w-full rounded-xl border border-white/20 bg-black/25 px-3 text-sm text-white placeholder:text-white/45 focus:border-cyan-300/50 focus:outline-none"
                      placeholder="Mot de passe membre"
                    />
                    <button type="button" onClick={() => setMemberPasswordVisible((prev) => ({ ...prev, [selectedMember.id]: !prev[selectedMember.id] }))} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 text-xs text-white/90 hover:bg-white/20">
                      {memberPasswordVisible[selectedMember.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {memberPasswordVisible[selectedMember.id] ? 'Masquer' : 'Voir'}
                    </button>
                    <button type="button" onClick={() => updateMemberDraft(selectedMember.id, { password: generatePassword({ avoidAmbiguous: true }) })} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 text-xs text-white/90 hover:bg-white/20">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Générer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const identifier = (selectedMember.player_identifier || '').trim()
                        const password = (selectedMember.password || '').trim()
                        const content = [
                          'Voici tes identifiants pour la tablette du groupe :',
                          'https://pykestock-ten.vercel.app/',
                          '',
                          `Identifiant: ${identifier || '—'}`,
                          `Mot de passe: ${password || '—'}`,
                          '',
                          'Tu peux modifier ton mot de passe avec le bouton "Changer mot de passe" dans le dashboard, en dessous de Déconnexion.',
                        ].join('\n')
                        void copyToClipboard(content)
                      }}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 text-xs text-white/90 hover:bg-white/20"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copier accès
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-white/60">Rôle</label>
                    <select value={selectedMember.grade_id ?? ''} onChange={(e) => updateMemberDraft(selectedMember.id, { grade_id: e.target.value || null })} className="mt-1 h-10 w-full rounded-xl border border-white/20 bg-black/25 px-3 text-sm text-white focus:border-cyan-300/50 focus:outline-none">
                      {roleOptions.map((opt) => (
                        <option key={`${selectedMember.id}-${opt.value || 'none'}`} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-xl border border-white/15 bg-black/20 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-white/60">Droits</p>
                    <label className="mt-1 inline-flex items-center gap-2 text-sm text-white/90">
                      <input type="checkbox" checked={selectedMember.is_admin} onChange={(e) => updateMemberDraft(selectedMember.id, { is_admin: e.target.checked })} className="h-4 w-4 rounded border-white/30 bg-black/25" />
                      <Shield className="h-4 w-4 text-amber-300" />
                      Membre admin
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-4">
                <button disabled={busy} onClick={() => void saveMember(selectedMember)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-cyan-300/45 bg-cyan-500/20 px-4 text-sm font-medium text-cyan-50 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  Enregistrer
                </button>
                <button disabled={busy} onClick={() => void removeMember(selectedMember.id)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-300/50 bg-rose-500/20 px-4 text-sm font-medium text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50">
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
    </div>
  )
}
