import type { TenantSession } from '@/lib/tenantSession'
import { isAdminTenantSession, isMemberTenantSession } from '@/lib/tenantSession'
import { DEFAULT_MEMBER_PREFIXES } from '@/lib/types/groupRoles'

const PUBLIC_PATHS = ['/', '/login', '/auth/bridge']

export function isMemberRouteAllowed(pathname: string, allowedPrefixes: string[] = DEFAULT_MEMBER_PREFIXES) {
  const prefixes = allowedPrefixes.length > 0 ? allowedPrefixes : DEFAULT_MEMBER_PREFIXES

  if (prefixes.includes('/')) {
    return true
  }

  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function getDefaultRouteForSession(session: TenantSession) {
  if (isAdminTenantSession(session)) return '/admin/dashboard'

  const allowedPrefixes = session.allowedPrefixes ?? []
  if (allowedPrefixes.includes('/')) return '/'
  if (allowedPrefixes.length > 0) return allowedPrefixes[0]

  if (isMemberTenantSession(session)) return '/tablette'
  return '/'
}

export function canAccessPath(session: TenantSession, pathname: string) {
  if (isAdminTenantSession(session)) return true
  if (PUBLIC_PATHS.includes(pathname)) return true

  const allowedPrefixes = session.allowedPrefixes ?? []
  if (allowedPrefixes.length > 0) return isMemberRouteAllowed(pathname, allowedPrefixes)

  if (!isMemberTenantSession(session)) return true
  return isMemberRouteAllowed(pathname)
}
