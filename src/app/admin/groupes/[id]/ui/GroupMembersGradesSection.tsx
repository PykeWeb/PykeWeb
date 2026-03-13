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
import { ROLE_ACCESS_OPTIONS } from '@/lib/types/groupRoles'
import type { GroupMember, GroupMemberCandidate, GroupMemberGrade, GroupMembersGradesPayload } from '@/lib/types/groupMembers'

type Props = {
  groupId: string
}

function applyPayload(setGrades: (next: GroupMemberGrade[]) => void, setMembers: (next: GroupMember[]) => void, setCandidates: (next: GroupMemberCandidate[]) => void, payload: GroupMembersGradesPayload) {
  setGrades(payload.grades)
  setMembers(payload.members)
  setCandidates(payload.playerCandidates)
}

export function GroupMembersGradesSection({ groupId }: Props) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [grades, setGrades] = useState<GroupMemberGrade[]>([])
  const [members, setMembers] = useState<GroupMember[]>([])
  const [playerCandidates, setPlayerCandidates] = useState<GroupMemberCandidate[]>([])

  const [newGradeName, setNewGradeName] = useState('')
  const [newGradePermissions, setNewGradePermissions] = useState<string[]>(['/tablette'])

  const [selectedPlayerName, setSelectedPlayerName] = useState('')
  const [customPlayerName, setCustomPlayerName] = useState('')
  const [newMemberIdentifier, setNewMemberIdentifier] = useState('')
  const [newMemberGradeId, setNewMemberGradeId] = useState('')

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      try {
        const payload = await listGroupMembersGrades(groupId)
        if (!alive) return
        applyPayload(setGrades, setMembers, setPlayerCandidates, payload)
        setError(null)
      } catch (e: unknown) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Impossible de charger les membres et grades.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    void load()

    return () => {
      alive = false
    }
  }, [groupId])

  const gradeOptions = useMemo(() => [{ value: '', label: 'Aucun grade' }, ...grades.map((grade) => ({ value: grade.id, label: grade.name }))], [grades])

  function toggleNewGradePermission(prefix: string) {
    setNewGradePermissions((prev) => {
      const exists = prev.includes(prefix)
      const next = exists ? prev.filter((entry) => entry !== prefix) : [...prev, prefix]
      return next.length > 0 ? next : ['/tablette']
    })
  }

  function updateGradeDraft(id: string, patch: Partial<GroupMemberGrade>) {
    setGrades((prev) => prev.map((grade) => (grade.id === id ? { ...grade, ...patch } : grade)))
  }

  function toggleGradePermission(id: string, prefix: string) {
    setGrades((prev) => prev.map((grade) => {
      if (grade.id !== id) return grade
      const exists = grade.permissions.includes(prefix)
      const next = exists ? grade.permissions.filter((entry) => entry !== prefix) : [...grade.permissions, prefix]
      return { ...grade, permissions: next.length > 0 ? next : ['/tablette'] }
    }))
  }

  function updateMemberDraft(id: string, patch: Partial<GroupMember>) {
    setMembers((prev) => prev.map((member) => (member.id === id ? { ...member, ...patch } : member)))
  }

  async function createGrade() {
    if (!newGradeName.trim()) {
      setError('Nom du grade requis.')
      return
    }
    try {
      setBusy(true)
      const payload = await createGroupMemberGrade(groupId, {
        name: newGradeName.trim(),
        permissions: newGradePermissions,
      })
      applyPayload(setGrades, setMembers, setPlayerCandidates, payload)
      setNewGradeName('')
      setNewGradePermissions(['/tablette'])
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Création du grade impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function saveGrade(grade: GroupMemberGrade) {
    if (!grade.name.trim()) {
      setError('Nom du grade requis.')
      return
    }
    try {
      setBusy(true)
      const payload = await updateGroupMemberGrade(groupId, grade.id, {
        name: grade.name.trim(),
        permissions: grade.permissions,
      })
      applyPayload(setGrades, setMembers, setPlayerCandidates, payload)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mise à jour du grade impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function removeGrade(gradeId: string) {
    try {
      setBusy(true)
      const payload = await deleteGroupMemberGrade(groupId, gradeId)
      applyPayload(setGrades, setMembers, setPlayerCandidates, payload)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Suppression du grade impossible.')
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
        grade_id: newMemberGradeId || null,
      })
      applyPayload(setGrades, setMembers, setPlayerCandidates, payload)
      setSelectedPlayerName('')
      setCustomPlayerName('')
      setNewMemberIdentifier('')
      setNewMemberGradeId('')
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
      applyPayload(setGrades, setMembers, setPlayerCandidates, payload)
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
      applyPayload(setGrades, setMembers, setPlayerCandidates, payload)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Suppression du membre impossible.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">Chargement membres & grades…</div>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow lg:p-8">
        <h2 className="text-2xl font-semibold">Membres & Grades</h2>
        <p className="mt-1 text-sm text-white/70">Gestion dédiée au groupe courant. Chaque membre et grade est lié au groupe sélectionné.</p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-white/80">Créer un grade</p>
            <div className="mt-2 grid gap-2">
              <input value={newGradeName} onChange={(e) => setNewGradeName(e.target.value)} placeholder="Nom du grade" className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
              <div className="flex flex-wrap gap-2">
                {ROLE_ACCESS_OPTIONS.map((option) => {
                  const selected = newGradePermissions.includes('/') || newGradePermissions.includes(option.prefix)
                  return (
                    <label key={`new-grade-${option.prefix}`} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-xs ${selected ? 'border-cyan-300/35 bg-cyan-500/20 text-cyan-100' : 'border-white/12 bg-white/[0.04] text-white/70'}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleNewGradePermission(option.prefix)} className="h-3.5 w-3.5" />
                      {option.label}
                    </label>
                  )
                })}
              </div>
              <button disabled={busy} onClick={() => void createGrade()} className="h-10 rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-3 text-sm text-cyan-50 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50">Créer grade</button>
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
              <select value={newMemberGradeId} onChange={(e) => setNewMemberGradeId(e.target.value)} className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm">
                {gradeOptions.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button disabled={busy} onClick={() => void createMemberEntry()} className="h-10 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 text-sm text-emerald-50 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50">Créer membre</button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow lg:p-8">
        <h3 className="text-xl font-semibold">Grades existants</h3>
        <div className="mt-3 space-y-3">
          {grades.length === 0 ? <p className="text-sm text-white/60">Aucun grade pour ce groupe.</p> : null}
          {grades.map((grade) => (
            <div key={grade.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-center">
                <input value={grade.name} onChange={(e) => updateGradeDraft(grade.id, { name: e.target.value })} className="h-10 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
                <button disabled={busy} onClick={() => void saveGrade(grade)} className="h-10 rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-3 text-sm text-cyan-50 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50">Enregistrer</button>
                <button disabled={busy} onClick={() => void removeGrade(grade.id)} className="h-10 rounded-xl border border-rose-300/35 bg-rose-500/15 px-3 text-sm text-rose-100 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50">Supprimer</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ROLE_ACCESS_OPTIONS.map((option) => {
                  const selected = grade.permissions.includes('/') || grade.permissions.includes(option.prefix)
                  return (
                    <label key={`${grade.id}-${option.prefix}`} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-xs ${selected ? 'border-cyan-300/35 bg-cyan-500/20 text-cyan-100' : 'border-white/12 bg-white/[0.04] text-white/70'}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleGradePermission(grade.id, option.prefix)} className="h-3.5 w-3.5" />
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
                  {gradeOptions.map((opt) => (
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
