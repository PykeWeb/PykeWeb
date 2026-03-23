import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveGroupLoginRole } from '@/lib/groupCredentials'
import {
  encodeTenantSession,
  TENANT_SESSION_COOKIE_KEY,
  TENANT_SESSION_VERSION,
  type TenantSessionPayload,
} from '@/lib/tenantSessionShared'

type LoginPayload = {
  login?: string
  password?: string
  remember?: boolean
}

type GroupRow = {
  id: string
  name: string
  badge: string | null
  login: string
  password: string
  active: boolean
  paid_until: string | null
}

type GroupMemberRow = {
  id: string
  group_id: string
  player_name: string
  player_identifier: string | null
  password: string | null
  is_admin: boolean
  grade_id: string | null
}

type RoleRow = {
  name: string
  permissions: string[] | null
}

const ROLE_TABLE_CANDIDATES = ['group_roles', 'group_member_grades'] as const

function isAdminGroup(group: Pick<GroupRow, 'login' | 'badge' | 'name'>) {
  return group.login.trim().toLowerCase() === 'admin'
    || (group.badge || '').trim().toLowerCase() === 'admin'
    || group.name.trim().toLowerCase() === 'administration'
}

function cookieOptions(remember = true) {
  return {
    path: '/',
    maxAge: remember ? 60 * 60 * 24 * 14 : undefined,
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  }
}

function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)))
}

function isMissingTableError(message: string) {
  return /does not exist|relation .* does not exist|Could not find the table/i.test(message)
}

async function resolveMemberRoleInfo(groupId: string, gradeId: string | null) {
  if (!gradeId) return { name: 'Membre', permissions: [] as string[] }
  const supabase = getSupabaseAdmin()
  for (const tableName of ROLE_TABLE_CANDIDATES) {
    const { data, error } = await supabase
      .from(tableName)
      .select('name,permissions')
      .eq('group_id', groupId)
      .eq('id', gradeId)
      .maybeSingle<RoleRow>()

    if (!error) return { name: data?.name || 'Membre', permissions: normalizePermissions(data?.permissions) }
    if (!isMissingTableError(error.message)) throw new Error(error.message)
  }
  return { name: 'Membre', permissions: [] as string[] }
}

async function findGroupByPrimaryLogin(login: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tenant_groups')
    .select('id,name,badge,login,password,active,paid_until')
    .eq('login', login)
    .maybeSingle<GroupRow>()

  if (error) throw new Error(error.message)
  return data
}

async function findGroupByMemberLogin(login: string, password: string) {
  const supabase = getSupabaseAdmin()
  const { data: members, error: membersError } = await supabase
    .from('group_members')
    .select('id,group_id,player_name,player_identifier,password,is_admin,grade_id')
    .eq('player_identifier', login)
    .eq('password', password)

  if (membersError) throw new Error(membersError.message)
  const matchedMembers = (members ?? []) as GroupMemberRow[]
  if (matchedMembers.length === 0) return null
  if (matchedMembers.length > 1) throw new Error('Identifiant membre ambigu. Utilisez un identifiant unique.')

  const member = matchedMembers[0]
  const { data: group, error: groupError } = await supabase
    .from('tenant_groups')
    .select('id,name,badge,login,password,active,paid_until')
    .eq('id', member.group_id)
    .maybeSingle<GroupRow>()

  if (groupError) throw new Error(groupError.message)
  if (!group) return null

  const roleInfo = member.is_admin ? { name: 'Boss', permissions: ['/'] } : await resolveMemberRoleInfo(group.id, member.grade_id)
  return {
    group,
    member,
    role: {
      key: member.is_admin ? 'boss' : 'member',
      name: roleInfo.name || 'Membre',
      allowedPrefixes: roleInfo.permissions.length > 0 ? roleInfo.permissions : ['/tablette'],
    },
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginPayload
    const login = body.login?.trim() || ''
    const password = body.password?.trim() || ''
    const remember = body.remember !== false

    if (!login || !password) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 400 })
    }

    const groupByPrimaryLogin = await findGroupByPrimaryLogin(login)
    const groupByMemberLogin = groupByPrimaryLogin ? null : await findGroupByMemberLogin(login, password)

    const data = groupByPrimaryLogin ?? groupByMemberLogin?.group ?? null
    if (!data) return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 })
    if (!data.active) return NextResponse.json({ error: 'Groupe désactivé' }, { status: 403 })
    if (data.paid_until && new Date(data.paid_until).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Accès expiré (paiement en retard).' }, { status: 403 })
    }

    const role = groupByMemberLogin?.role ?? resolveGroupLoginRole(data.password, password)
    if (!role) return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 })

    const isAdmin = isAdminGroup(data)
    const session: TenantSessionPayload = {
      v: TENANT_SESSION_VERSION,
      groupId: isAdmin ? 'admin' : data.id,
      groupName: isAdmin ? 'Administration' : data.name,
      groupBadge: isAdmin ? 'ADMIN' : data.badge,
      isAdmin,
      role: isAdmin ? 'chef' : role.key,
      roleLabel: isAdmin ? 'Administration' : role.name,
      memberName: isAdmin ? 'Administration' : (groupByMemberLogin?.member.player_name || (role.key === 'chef' ? 'Boss' : role.name || 'Membre')),
      allowedPrefixes: isAdmin ? ['/'] : role.allowedPrefixes,
    }

    const response = NextResponse.json({
      group: {
        ...data,
        password: '',
      },
      session,
    })
    response.cookies.set(TENANT_SESSION_COOKIE_KEY, encodeTenantSession(session), cookieOptions(remember))
    return response
  } catch {
    return NextResponse.json({ error: 'Payload invalide' }, { status: 400 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(TENANT_SESSION_COOKIE_KEY, '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
