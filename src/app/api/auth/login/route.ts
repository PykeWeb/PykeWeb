import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  encodeTenantSession,
  TENANT_SESSION_COOKIE_KEY,
  TENANT_SESSION_VERSION,
  type TenantSessionPayload,
} from '@/lib/tenantSessionShared'

type LoginPayload = {
  login?: string
  password?: string
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

function isAdminGroup(group: Pick<GroupRow, 'login' | 'badge' | 'name'>) {
  return group.login.trim().toLowerCase() === 'admin'
    || (group.badge || '').trim().toLowerCase() === 'admin'
    || group.name.trim().toLowerCase() === 'administration'
}

function cookieOptions() {
  return {
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginPayload
    const login = body.login?.trim() || ''
    const password = body.password?.trim() || ''

    if (!login || !password) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('tenant_groups')
      .select('id,name,badge,login,password,active,paid_until')
      .eq('login', login)
      .eq('password', password)
      .maybeSingle<GroupRow>()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 })
    if (!data.active) return NextResponse.json({ error: 'Groupe désactivé' }, { status: 403 })
    if (data.paid_until && new Date(data.paid_until).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Accès expiré (paiement en retard).' }, { status: 403 })
    }

    const isAdmin = isAdminGroup(data)
    const session: TenantSessionPayload = {
      v: TENANT_SESSION_VERSION,
      groupId: isAdmin ? 'admin' : data.id,
      groupName: isAdmin ? 'Administration' : data.name,
      groupBadge: isAdmin ? 'ADMIN' : data.badge,
      isAdmin,
    }

    const response = NextResponse.json({ group: data, session })
    response.cookies.set(TENANT_SESSION_COOKIE_KEY, encodeTenantSession(session), cookieOptions())
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
