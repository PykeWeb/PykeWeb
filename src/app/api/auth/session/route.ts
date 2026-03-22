import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getSessionFromRequest } from '@/server/auth/session'
import {
  encodeTenantSession,
  isAdminSession,
  isValidTenantSession,
  TENANT_SESSION_COOKIE_KEY,
  TENANT_SESSION_VERSION,
  type TenantSessionPayload,
} from '@/lib/tenantSessionShared'

function cookieOptions(remember = true) {
  return {
    path: '/',
    maxAge: remember ? 60 * 60 * 24 * 14 : undefined,
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  }
}

type GroupAccessRow = {
  id: string
  name: string
  badge: string | null
  active: boolean
  paid_until: string | null
}

function clearCookieOn(response: NextResponse) {
  response.cookies.set(TENANT_SESSION_COOKIE_KEY, '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    const response = NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    clearCookieOn(response)
    return response
  }

  if (isAdminSession(session)) {
    const normalizedAdmin = { ...session, v: TENANT_SESSION_VERSION }
    const response = NextResponse.json({ ok: true, session: normalizedAdmin })
    response.cookies.set(TENANT_SESSION_COOKIE_KEY, encodeTenantSession(normalizedAdmin), cookieOptions(true))
    return response
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tenant_groups')
    .select('id,name,badge,active,paid_until')
    .eq('id', session.groupId)
    .maybeSingle<GroupAccessRow>()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || !data.active) {
    const response = NextResponse.json({ error: 'Accès groupe désactivé.' }, { status: 403 })
    clearCookieOn(response)
    return response
  }
  if (data.paid_until && new Date(data.paid_until).getTime() < Date.now()) {
    const response = NextResponse.json({ error: 'Accès expiré (paiement en retard).' }, { status: 403 })
    clearCookieOn(response)
    return response
  }

  const normalized: TenantSessionPayload = {
    ...session,
    groupName: data.name,
    groupBadge: data.badge,
    v: TENANT_SESSION_VERSION,
  }

  const response = NextResponse.json({ ok: true, session: normalized })
  response.cookies.set(TENANT_SESSION_COOKIE_KEY, encodeTenantSession(normalized), cookieOptions(true))
  return response
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { session?: TenantSessionPayload; remember?: boolean }
    const session = body.session
    const remember = body.remember !== false

    if (!session || !isValidTenantSession({ ...session, v: TENANT_SESSION_VERSION })) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 400 })
    }

    const normalized: TenantSessionPayload = {
      ...session,
      v: TENANT_SESSION_VERSION,
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set(TENANT_SESSION_COOKIE_KEY, encodeTenantSession(normalized), cookieOptions(remember))
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
