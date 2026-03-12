import type { TenantSession } from '@/lib/tenantSession'
import { isAdminTenantSession, isMemberTenantSession } from '@/lib/tenantSession'

const MEMBER_ALLOWED_PREFIXES = ['/tablette', '/finance/depense', '/depenses']

export function isMemberRouteAllowed(pathname: string) {
  return MEMBER_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function getDefaultRouteForSession(session: TenantSession) {
  if (isAdminTenantSession(session)) return '/admin/dashboard'
  if (isMemberTenantSession(session)) return '/tablette'
  return '/'
}

export function canAccessPath(session: TenantSession, pathname: string) {
  if (isAdminTenantSession(session)) return true
  if (!isMemberTenantSession(session)) return true
  if (pathname === '/' || pathname === '/login' || pathname === '/auth/bridge') return true
  return isMemberRouteAllowed(pathname)
}
