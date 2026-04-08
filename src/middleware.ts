import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decodeTenantSession, isValidTenantSession, TENANT_SESSION_COOKIE_KEY } from '@/lib/tenantSessionShared'
import { canAccessPath, getDefaultRouteForSession } from '@/lib/accessControl'

const PUBLIC_PATHS = new Set(['/login', '/auth/bridge'])

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  const raw = request.cookies.get(TENANT_SESSION_COOKIE_KEY)?.value
  const session = raw ? decodeTenantSession(raw) : null
  if (!session || !isValidTenantSession(session)) {
    if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (PUBLIC_PATHS.has(pathname)) {
    const defaultRoute = getDefaultRouteForSession(session)
    return NextResponse.redirect(new URL(defaultRoute, request.url))
  }

  if (!canAccessPath(session, pathname)) {
    const target = getDefaultRouteForSession(session)
    return NextResponse.redirect(new URL(target, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
