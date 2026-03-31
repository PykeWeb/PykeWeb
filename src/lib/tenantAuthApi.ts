import { withTenantSessionHeader } from '@/lib/tenantRequest'
import type { GroupRoleDefinition } from '@/lib/types/groupRoles'
import type { GroupMember, GroupMemberGrade, GroupMembersGradesPayload } from '@/lib/types/groupMembers'

async function readApiError(res: Response) {
  try {
    const json = (await res.json()) as { error?: string }
    return json.error || 'Erreur API'
  } catch {
    return (await res.text()) || 'Erreur API'
  }
}

export type TenantGroup = {
  id: string
  name: string
  badge: string | null
  login: string
  password: string
  password_member?: string | null
  roles?: GroupRoleDefinition[]
  active: boolean
  paid_until: string | null
  created_at?: string
}

export async function listTenantGroups() {
  const res = await fetch('/api/admin/groups', withTenantSessionHeader({ cache: 'no-store' }))
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as TenantGroup[]
}

export async function createTenantGroup(input: Omit<TenantGroup, 'id' | 'created_at'>) {
  const res = await fetch('/api/admin/groups', {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as TenantGroup
}

export async function updateTenantGroup(id: string, patch: Partial<Omit<TenantGroup, 'id' | 'created_at'>>) {
  const res = await fetch('/api/admin/groups', {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'PUT',
    body: JSON.stringify({ id, patch }),
  })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as TenantGroup
}

export async function deleteTenantGroup(id: string) {
  const res = await fetch('/api/admin/groups', {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error(await readApiError(res))
}

export async function getTenantGroup(id: string) {
  const res = await fetch(`/api/admin/groups/${id}`, withTenantSessionHeader({ cache: 'no-store' }))
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as TenantGroup
}

export async function resetTenantGroupData(id: string) {
  const res = await fetch(`/api/admin/groups/${id}/reset`, {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'POST',
  })
  if (!res.ok) throw new Error(await readApiError(res))
}

export async function loginTenant(login: string, password: string, remember = true) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ login, password, remember }),
  })
  if (!res.ok) throw new Error(await readApiError(res))
  const json = (await res.json()) as { group: TenantGroup; session: { groupId: string; groupName: string; groupBadge?: string | null; isAdmin?: boolean; memberId?: string; role?: string; roleLabel?: string; allowedPrefixes?: string[] } }
  return json
}

export async function changeMemberPassword(currentPassword: string, newPassword: string) {
  const res = await fetch('/api/auth/change-password', {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if (!res.ok) throw new Error(await readApiError(res))
}


export async function listGroupMembersGrades(groupId: string) {
  const res = await fetch(`/api/admin/groups/${groupId}/members-grades`, withTenantSessionHeader({ cache: 'no-store' }))
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as GroupMembersGradesPayload
}

export async function createGroupMemberGrade(groupId: string, input: { name: string; permissions: string[] }) {
  const res = await fetch(`/api/admin/groups/${groupId}/members-grades`, {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'POST',
    body: JSON.stringify({ entity: 'grade', ...input }),
  })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as GroupMembersGradesPayload
}

export async function updateGroupMemberGrade(groupId: string, id: string, patch: { name: string; permissions: string[] }) {
  const res = await fetch(`/api/admin/groups/${groupId}/members-grades`, {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'PUT',
    body: JSON.stringify({ entity: 'grade', id, patch }),
  })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as GroupMembersGradesPayload
}

export async function deleteGroupMemberGrade(groupId: string, id: string) {
  const res = await fetch(`/api/admin/groups/${groupId}/members-grades`, {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'DELETE',
    body: JSON.stringify({ entity: 'grade', id }),
  })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as GroupMembersGradesPayload
}

export async function createGroupMember(groupId: string, input: { player_name: string; player_identifier?: string | null; password?: string | null; is_admin?: boolean; grade_id?: string | null }) {
  const res = await fetch(`/api/admin/groups/${groupId}/members-grades`, {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'POST',
    body: JSON.stringify({ entity: 'member', ...input }),
  })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as GroupMembersGradesPayload
}

export async function updateGroupMember(groupId: string, id: string, patch: { player_name: string; player_identifier?: string | null; password?: string | null; is_admin?: boolean; grade_id?: string | null }) {
  const res = await fetch(`/api/admin/groups/${groupId}/members-grades`, {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'PUT',
    body: JSON.stringify({ entity: 'member', id, patch }),
  })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as GroupMembersGradesPayload
}

export async function deleteGroupMember(groupId: string, id: string) {
  const res = await fetch(`/api/admin/groups/${groupId}/members-grades`, {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'DELETE',
    body: JSON.stringify({ entity: 'member', id }),
  })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as GroupMembersGradesPayload
}
