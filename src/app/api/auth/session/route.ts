import { NextResponse } from 'next/server'
import {
  encodeTenantSession,
  isValidTenantSession,
  TENANT_SESSION_COOKIE_KEY,
  TENANT_SESSION_VERSION,
  type TenantSessionPayload,
} from '@/lib/tenantSessionShared'

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
    const body = (await request.json()) as { session?: TenantSessionPayload }
    const session = body.session

    if (!session || !isValidTenantSession({ ...session, v: TENANT_SESSION_VERSION })) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 400 })
    }

    const normalized: TenantSessionPayload = {
      ...session,
      v: TENANT_SESSION_VERSION,
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set(TENANT_SESSION_COOKIE_KEY, encodeTenantSession(normalized), cookieOptions())
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
