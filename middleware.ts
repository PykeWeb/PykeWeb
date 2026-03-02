import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico']
const COOKIE_KEY = 'tenant_session_v3'
const SESSION_VERSION = 3
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type TenantSession = {
  v?: number
  groupId?: string
  groupName?: string
  isAdmin?: boolean
}

function parseSessionCookie(raw: string | undefined): TenantSession | null {
  if (!raw) return null
  try {
    const json = atob(raw)
    return JSON.parse(json) as TenantSession
  } catch {
    return null
  }
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  const response = NextResponse.redirect(url)
  response.cookies.set(COOKIE_KEY, '', { path: '/', maxAge: 0, sameSite: 'lax' })
  return response
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const token = request.cookies.get(COOKIE_KEY)?.value
  const session = parseSessionCookie(token)
  if (!session?.groupId || !session.groupName?.trim()) return redirectToLogin(request)
  if ((session.v ?? 0) !== SESSION_VERSION) return redirectToLogin(request)

  if (session.groupId === 'admin' || session.isAdmin) {
    if (!pathname.startsWith('/admin/groupes')) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/groupes'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  if (!UUID_RE.test(session.groupId)) return redirectToLogin(request)

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|.*\\..*).*)'],
}
