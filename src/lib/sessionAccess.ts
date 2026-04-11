import { hasRequiredPrefixAccess } from '@/lib/accessControl'
import { expandAccessPrefixes } from '@/lib/types/groupRoles'
import type { TenantSession } from '@/lib/tenantSession'

export function sessionAllowedPrefixes(session: TenantSession | null | undefined) {
  if (!session) return []
  if (session.isAdmin || session.groupId === 'admin') return ['/']
  return expandAccessPrefixes(Array.isArray(session.allowedPrefixes) ? session.allowedPrefixes : [])
}

export function sessionCanAccessPrefix(session: TenantSession | null | undefined, prefix: string) {
  const allowed = sessionAllowedPrefixes(session)
  return hasRequiredPrefixAccess(allowed, prefix)
}

export function sessionCanManageSensitiveGroupSettings(session: TenantSession | null | undefined) {
  const allowed = sessionAllowedPrefixes(session)
  return allowed.includes('/') || allowed.includes('/group')
}
