import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/server/auth/session'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { isAdminSession } from '@/lib/tenantSessionShared'
import type { GroupMember, GroupMemberCandidate, GroupMemberRole } from '@/lib/types/groupMembers'

type GroupRow = { id: string; login: string }

type MemberRow = {
  id: string
  group_id: string
  player_name: string
  player_identifier: string | null
  grade_id: string | null
  created_at: string
  updated_at: string
}

type RoleRow = {
  id: string
  group_id: string
  name: string
  permissions: string[] | null
  created_at: string
  updated_at: string
}

const ROLE_TABLE_CANDIDATES = ['group_roles', 'group_member_grades'] as const
type RoleTableName = typeof ROLE_TABLE_CANDIDATES[number]

function isMissingTableError(message: string) {
  return /does not exist|relation .* does not exist|Could not find the table/i.test(message)
}

async function resolveRoleTableName(): Promise<RoleTableName> {
  const supabase = getSupabaseAdmin()

  for (const tableName of ROLE_TABLE_CANDIDATES) {
    const { error } = await supabase.from(tableName).select('id').limit(1)
    if (!error) return tableName
    if (!isMissingTableError(error.message)) throw new Error(error.message)
  }

  throw new Error("Structure rôles introuvable. Lancez les migrations Supabase pour créer 'group_roles' ou 'group_member_grades'.")
}

async function resolveGroupId(rawId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const { data: byId, error: byIdError } = await supabase
    .from('tenant_groups')
    .select('id,login')
    .eq('id', rawId)
    .maybeSingle<GroupRow>()

  if (byIdError) throw new Error(byIdError.message)
  if (byId?.id) return byId.id

  const { data: byLogin, error: byLoginError } = await supabase
    .from('tenant_groups')
    .select('id,login')
    .eq('login', rawId)
    .maybeSingle<GroupRow>()

  if (byLoginError) throw new Error(byLoginError.message)
  return byLogin?.id ?? null
}

function canManageGroupFromSession(session: { allowedPrefixes?: string[] } | null) {
  const prefixes = Array.isArray(session?.allowedPrefixes) ? session.allowedPrefixes : []
  return prefixes.includes('/') || prefixes.includes('/group')
}

async function assertGroupMembersRolesAccess(request: Request, rawGroupId: string) {
  const session = await getSessionFromRequest(request)
  if (!session) throw new Error('Session invalide')

  const groupId = await resolveGroupId(rawGroupId)
  if (!groupId) return { groupId: null as string | null }

  if (isAdminSession(session)) return { groupId }
  if (session.groupId !== groupId) throw new Error('Accès refusé à ce groupe.')
  if (!canManageGroupFromSession(session)) throw new Error('Permission insuffisante pour gérer les membres et rôles.')

  return { groupId }
}

function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const cleaned = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
  return Array.from(new Set(cleaned))
}

async function readPlayerCandidates(groupId: string): Promise<GroupMemberCandidate[]> {
  const supabase = getSupabaseAdmin()
  const candidateNames = new Set<string>()

  const collectFromTable = async (table: string, column: string) => {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .eq('group_id', groupId)
      .limit(200)

    if (error) {
      if (isMissingTableError(error.message)) return
      throw new Error(error.message)
    }

    const rows = Array.isArray(data) ? data : []
    for (const row of rows) {
      if (typeof row !== 'object' || row === null || !(column in row)) continue
      const raw = (row as Record<string, unknown>)[column]
      if (typeof raw !== 'string') continue
      const normalized = raw.trim()
      if (normalized.length === 0) continue
      candidateNames.add(normalized)
    }
  }

  await collectFromTable('group_members', 'player_name')
  await collectFromTable('group_activity_entries', 'member_name')
  await collectFromTable('tablet_daily_runs', 'member_name')
  await collectFromTable('expenses', 'member_name')

  return [...candidateNames]
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((name) => ({ value: name, label: name }))
}

async function fetchPayload(groupId: string, roleTableName: RoleTableName) {
  const supabase = getSupabaseAdmin()

  const [{ data: roleRows, error: rolesError }, { data: memberRows, error: membersError }, playerCandidates] = await Promise.all([
    supabase
      .from(roleTableName)
      .select('id,group_id,name,permissions,created_at,updated_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true }),
    supabase
      .from('group_members')
      .select('id,group_id,player_name,player_identifier,grade_id,created_at,updated_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true }),
    readPlayerCandidates(groupId),
  ])

  if (rolesError) throw new Error(rolesError.message)
  if (membersError) throw new Error(membersError.message)

  const roles: GroupMemberRole[] = ((roleRows ?? []) as RoleRow[]).map((row) => ({
    ...row,
    permissions: normalizePermissions(row.permissions),
  }))

  const roleById = new Map(roles.map((role) => [role.id, role]))

  const members: GroupMember[] = ((memberRows ?? []) as MemberRow[]).map((row) => ({
    ...row,
    grade: row.grade_id ? (roleById.get(row.grade_id) ?? null) : null,
  }))

  return { grades: roles, members, playerCandidates }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { groupId } = await assertGroupMembersRolesAccess(request, params.id)
    if (!groupId) return NextResponse.json({ error: 'Groupe introuvable.' }, { status: 404 })

    const roleTableName = await resolveRoleTableName()
    const payload = await fetchPayload(groupId, roleTableName)
    return NextResponse.json(payload)
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 400 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { groupId } = await assertGroupMembersRolesAccess(request, params.id)
    if (!groupId) return NextResponse.json({ error: 'Groupe introuvable.' }, { status: 404 })

    const body = (await request.json()) as Record<string, unknown>
    const entity = String(body.entity || '')
    const supabase = getSupabaseAdmin()
    const roleTableName = await resolveRoleTableName()

    if (entity === 'grade') {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const permissions = normalizePermissions(body.permissions)
      if (!name) return NextResponse.json({ error: 'Nom du rôle requis.' }, { status: 400 })

      const { error } = await supabase.from(roleTableName).insert({
        group_id: groupId,
        name,
        permissions,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(await fetchPayload(groupId, roleTableName))
    }

    if (entity === 'member') {
      const playerName = typeof body.player_name === 'string' ? body.player_name.trim() : ''
      const playerIdentifier = typeof body.player_identifier === 'string' ? body.player_identifier.trim() : ''
      const gradeId = typeof body.grade_id === 'string' ? body.grade_id.trim() : ''

      if (!playerName) return NextResponse.json({ error: 'Nom du membre requis.' }, { status: 400 })

      if (gradeId) {
        const { data: roleExists, error: roleError } = await supabase
          .from(roleTableName)
          .select('id')
          .eq('id', gradeId)
          .eq('group_id', groupId)
          .maybeSingle()
        if (roleError) return NextResponse.json({ error: roleError.message }, { status: 400 })
        if (!roleExists) return NextResponse.json({ error: 'Rôle introuvable pour ce groupe.' }, { status: 400 })
      }

      const { error } = await supabase.from('group_members').insert({
        group_id: groupId,
        player_name: playerName,
        player_identifier: playerIdentifier || null,
        grade_id: gradeId || null,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(await fetchPayload(groupId, roleTableName))
    }

    return NextResponse.json({ error: 'Entity non supportée.' }, { status: 400 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 400 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { groupId } = await assertGroupMembersRolesAccess(request, params.id)
    if (!groupId) return NextResponse.json({ error: 'Groupe introuvable.' }, { status: 404 })

    const body = (await request.json()) as Record<string, unknown>
    const entity = String(body.entity || '')
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) return NextResponse.json({ error: 'ID requis.' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const roleTableName = await resolveRoleTableName()

    if (entity === 'grade') {
      const patch = body.patch as Record<string, unknown> | undefined
      const name = typeof patch?.name === 'string' ? patch.name.trim() : ''
      const permissions = normalizePermissions(patch?.permissions)
      if (!name) return NextResponse.json({ error: 'Nom du rôle requis.' }, { status: 400 })

      const { error } = await supabase
        .from(roleTableName)
        .update({ name, permissions })
        .eq('id', id)
        .eq('group_id', groupId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(await fetchPayload(groupId, roleTableName))
    }

    if (entity === 'member') {
      const patch = body.patch as Record<string, unknown> | undefined
      const playerName = typeof patch?.player_name === 'string' ? patch.player_name.trim() : ''
      const playerIdentifier = typeof patch?.player_identifier === 'string' ? patch.player_identifier.trim() : ''
      const gradeId = typeof patch?.grade_id === 'string' ? patch.grade_id.trim() : ''
      if (!playerName) return NextResponse.json({ error: 'Nom du membre requis.' }, { status: 400 })

      if (gradeId) {
        const { data: roleExists, error: roleError } = await supabase
          .from(roleTableName)
          .select('id')
          .eq('id', gradeId)
          .eq('group_id', groupId)
          .maybeSingle()
        if (roleError) return NextResponse.json({ error: roleError.message }, { status: 400 })
        if (!roleExists) return NextResponse.json({ error: 'Rôle introuvable pour ce groupe.' }, { status: 400 })
      }

      const { error } = await supabase
        .from('group_members')
        .update({
          player_name: playerName,
          player_identifier: playerIdentifier || null,
          grade_id: gradeId || null,
        })
        .eq('id', id)
        .eq('group_id', groupId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(await fetchPayload(groupId, roleTableName))
    }

    return NextResponse.json({ error: 'Entity non supportée.' }, { status: 400 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { groupId } = await assertGroupMembersRolesAccess(request, params.id)
    if (!groupId) return NextResponse.json({ error: 'Groupe introuvable.' }, { status: 404 })

    const body = (await request.json()) as Record<string, unknown>
    const entity = String(body.entity || '')
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) return NextResponse.json({ error: 'ID requis.' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const roleTableName = await resolveRoleTableName()

    if (entity === 'grade') {
      const { error } = await supabase
        .from(roleTableName)
        .delete()
        .eq('id', id)
        .eq('group_id', groupId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(await fetchPayload(groupId, roleTableName))
    }

    if (entity === 'member') {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', id)
        .eq('group_id', groupId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json(await fetchPayload(groupId, roleTableName))
    }

    return NextResponse.json({ error: 'Entity non supportée.' }, { status: 400 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 400 })
  }
}
