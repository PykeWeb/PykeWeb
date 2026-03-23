import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertAdminSession } from '@/server/auth/admin'
import { encodeGroupCredentials, parseGroupCredentials, parseGroupRolesConfig } from '@/lib/groupCredentials'
import type { GroupRoleDefinition } from '@/lib/types/groupRoles'

const TABLE = 'tenant_groups'
const ROLE_TABLE_CANDIDATES = ['group_roles', 'group_member_grades'] as const
type RoleTableName = typeof ROLE_TABLE_CANDIDATES[number]

type GroupRecord = {
  id: string
  name: string
  badge: string | null
  login: string
  password: string
  active: boolean
  paid_until: string | null
  created_at?: string
}

function normalizeGroupRecord(row: GroupRecord) {
  const credentials = parseGroupCredentials(row.password)
  return {
    ...row,
    password: credentials.chefPassword,
    password_member: credentials.memberPassword,
    roles: parseGroupRolesConfig(row.password).roles,
  }
}

function normalizePayload(payload: Record<string, unknown>) {
  const chefPassword = typeof payload.password === 'string' ? payload.password.trim() : ''
  const memberPassword = typeof payload.password_member === 'string' ? payload.password_member.trim() : ''
  const next = { ...payload } as Record<string, unknown>
  const rolePayload = Array.isArray(payload.roles) ? payload.roles as GroupRoleDefinition[] : undefined

  if (typeof payload.password !== 'undefined' || typeof payload.password_member !== 'undefined' || typeof payload.roles !== 'undefined') {
    next.password = encodeGroupCredentials({ chefPassword, memberPassword, roles: rolePayload })
  }

  delete next.password_member
  delete next.roles
  return next
}

function isMissingTableError(message: string) {
  return /does not exist|relation .* does not exist|Could not find the table/i.test(message)
}

async function resolveRoleTableName() {
  const supabase = getSupabaseAdmin()
  for (const tableName of ROLE_TABLE_CANDIDATES) {
    const { error } = await supabase.from(tableName).select('id').limit(1)
    if (!error) return tableName as RoleTableName
    if (!isMissingTableError(error.message)) throw new Error(error.message)
  }
  throw new Error("Structure rôles introuvable. Lancez les migrations Supabase pour créer 'group_roles' ou 'group_member_grades'.")
}

async function createBossAccessForGroup(group: Pick<GroupRecord, 'id' | 'login' | 'password'>) {
  const supabase = getSupabaseAdmin()
  const credentials = parseGroupCredentials(group.password)
  const bossPassword = credentials.chefPassword.trim()
  const bossIdentifier = group.login.trim()

  if (!bossIdentifier || !bossPassword) return

  const roleTable = await resolveRoleTableName()
  const { data: existingBossRole, error: existingRoleError } = await supabase
    .from(roleTable)
    .select('id')
    .eq('group_id', group.id)
    .eq('name', 'Boss')
    .maybeSingle()

  if (existingRoleError) throw new Error(existingRoleError.message)

  let bossRoleId = existingBossRole?.id ?? null
  if (!bossRoleId) {
    const { data: createdBossRole, error: roleError } = await supabase
      .from(roleTable)
      .insert({
        group_id: group.id,
        name: 'Boss',
        permissions: ['/'],
      })
      .select('id')
      .single()

    if (roleError) throw new Error(roleError.message)
    bossRoleId = createdBossRole?.id ?? null
  } else {
    const { error: roleUpdateError } = await supabase
      .from(roleTable)
      .update({ permissions: ['/'] })
      .eq('id', bossRoleId)
      .eq('group_id', group.id)
    if (roleUpdateError) throw new Error(roleUpdateError.message)
  }

  const { data: existingBossMember, error: existingMemberError } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('player_identifier', bossIdentifier)
    .maybeSingle()

  if (existingMemberError) throw new Error(existingMemberError.message)

  if (existingBossMember?.id) {
    const { error: updateMemberError } = await supabase
      .from('group_members')
      .update({
        player_name: 'Boss',
        password: bossPassword,
        is_admin: true,
        grade_id: bossRoleId,
      })
      .eq('id', existingBossMember.id)
      .eq('group_id', group.id)
    if (updateMemberError) throw new Error(updateMemberError.message)
    return
  }

  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: group.id,
    player_name: 'Boss',
    player_identifier: bossIdentifier,
    password: bossPassword,
    is_admin: true,
    grade_id: bossRoleId,
  })
  if (memberError) throw new Error(memberError.message)
}

async function ensurePwrGroup() {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        name: 'PWR',
        badge: 'PWR',
        login: 'pwr',
        password: 'pwr',
        active: true,
        paid_until: null,
      },
      { onConflict: 'login', ignoreDuplicates: true },
    )

  if (error) throw new Error(error.message)
}

export async function GET(request: Request) {
  try {
    await assertAdminSession(request)
    await ensurePwrGroup()
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from(TABLE)
      .select('id,name,badge,login,password,active,paid_until,created_at')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json((data ?? []).map((row) => normalizeGroupRecord(row as GroupRecord)))
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Non autorisé' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    await assertAdminSession(request)
    const body = normalizePayload(await request.json())
    await ensurePwrGroup()
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from(TABLE)
      .insert(body)
      .select('id,name,badge,login,password,active,paid_until,created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await createBossAccessForGroup(data as GroupRecord)
    return NextResponse.json(normalizeGroupRecord(data as GroupRecord))
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    await assertAdminSession(request)
    const body = await request.json() as { id?: string; patch?: Record<string, unknown> }
    await ensurePwrGroup()
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from(TABLE)
      .update(normalizePayload(body.patch || {}))
      .eq('id', String(body.id))
      .select('id,name,badge,login,password,active,paid_until,created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(normalizeGroupRecord(data as GroupRecord))
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    await assertAdminSession(request)
    const body = await request.json()
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from(TABLE).delete().eq('id', String(body.id))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 400 })
  }
}
