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
  image_url: string | null
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
const TRANSIENT_DB_ERROR_HINTS = ['timeout', '522', 'network', 'fetch failed', 'cloudflare']

function isAdminGroup(group: Pick<GroupRow, 'login' | 'badge' | 'name'>) {
  return group.login.trim().toLowerCase() === 'admin'
    || (group.badge || '').trim().toLowerCase() === 'admin'
    || group.name.trim().toLowerCase() === 'administration'
}

function normalizeRoleLabel(role: { key: string; name: string }) {
  if (role.key === 'chef') return 'Boss'
  return role.name
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

function isMissingColumnError(message: string, column: string) {
  const lower = message.toLowerCase()
  return lower.includes(column.toLowerCase()) && (lower.includes('does not exist') || lower.includes('could not find') || lower.includes('column'))
}

function cleanDatabaseErrorMessage(message: string) {
  const raw = String(message || '')
  if (raw.includes('<!DOCTYPE html>') || raw.includes('<html')) {
    return 'Connexion à la base impossible (timeout). Réessaie dans quelques secondes.'
  }
  return raw
}

function isTransientDatabaseError(message: string) {
  const lower = String(message || '').toLowerCase()
  return TRANSIENT_DB_ERROR_HINTS.some((hint) => lower.includes(hint))
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const msg = error instanceof Error ? error.message : String(error || '')
      if (!isTransientDatabaseError(msg) || attempt === retries) break
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
    }
  }
  throw lastError
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
  let { data, error } = await withRetry(async () => supabase
    .from('tenant_groups')
    .select('id,name,badge,login,password,active,paid_until,image_url')
    .eq('login', login)
    .maybeSingle<GroupRow>())

  if (error && isMissingColumnError(error.message, 'image_url')) {
    const fallback = await supabase
      .from('tenant_groups')
      .select('id,name,badge,login,password,active,paid_until')
      .eq('login', login)
      .maybeSingle<Omit<GroupRow, 'image_url'>>()
    error = fallback.error
    data = fallback.data ? { ...fallback.data, image_url: null } as GroupRow : null
  }

  if (error) throw new Error(cleanDatabaseErrorMessage(error.message))
  return data
}

async function findGroupByMemberLogin(login: string, password: string) {
  const supabase = getSupabaseAdmin()
  const { data: members, error: membersError } = await withRetry(async () => supabase
    .from('group_members')
    .select('id,group_id,player_name,player_identifier,password,is_admin,grade_id')
    .eq('player_identifier', login)
    .eq('password', password))

  if (membersError) throw new Error(cleanDatabaseErrorMessage(membersError.message))
  const matchedMembers = (members ?? []) as GroupMemberRow[]
  if (matchedMembers.length === 0) return null
  if (matchedMembers.length > 1) throw new Error('Ce mot de passe pour cet identifiant est déjà utilisé par un autre groupe. Utilisez un mot de passe unique.')

  const member = matchedMembers[0]
  let { data: group, error: groupError } = await withRetry(async () => supabase
    .from('tenant_groups')
    .select('id,name,badge,login,password,active,paid_until,image_url')
    .eq('id', member.group_id)
    .maybeSingle<GroupRow>())

  if (groupError && isMissingColumnError(groupError.message, 'image_url')) {
    const fallback = await supabase
      .from('tenant_groups')
      .select('id,name,badge,login,password,active,paid_until')
      .eq('id', member.group_id)
      .maybeSingle<Omit<GroupRow, 'image_url'>>()
    groupError = fallback.error
    group = fallback.data ? { ...fallback.data, image_url: null } as GroupRow : null
  }

  if (groupError) throw new Error(cleanDatabaseErrorMessage(groupError.message))
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
      groupLogoUrl: isAdmin ? null : data.image_url,
      isAdmin,
      memberId: groupByMemberLogin?.member.id,
      role: isAdmin ? 'chef' : role.key,
      roleLabel: isAdmin ? 'Administration' : normalizeRoleLabel(role),
      memberName: isAdmin ? 'Administration' : (groupByMemberLogin?.member.player_name || (role.key === 'chef' ? 'Boss' : normalizeRoleLabel(role) || 'Membre')),
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
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payload invalide' }, { status: 400 })
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
