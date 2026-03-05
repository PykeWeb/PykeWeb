import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  decodeTenantSession,
  isAdminSession,
  isValidTenantSession,
  TENANT_SESSION_COOKIE_KEY,
} from '@/lib/tenantSessionShared'

const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico']

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  const response = NextResponse.redirect(url)
  response.cookies.set(TENANT_SESSION_COOKIE_KEY, '', { path: '/', maxAge: 0, sameSite: 'lax' })
  return response
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const token = request.cookies.get(TENANT_SESSION_COOKIE_KEY)?.value
  const session = decodeTenantSession(token)
  if (!isValidTenantSession(session)) return redirectToLogin(request)

  const isAdminUser = isAdminSession(session)

  if (isAdminUser) {
    if (!pathname.startsWith('/admin')) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/dashboard'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|.*\\..*).*)'],
}
