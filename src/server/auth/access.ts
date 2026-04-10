import { expandAccessPrefixes } from '@/lib/types/groupRoles'
import { hasRequiredPrefixAccess } from '@/lib/accessControl'
import type { AppServerSession } from '@/server/auth/session'

export function getSessionAllowedPrefixes(session: Pick<AppServerSession, 'allowedPrefixes' | 'isAdmin' | 'groupId'>) {
  if (session.isAdmin || session.groupId === 'admin') return ['/']
  const raw = Array.isArray(session.allowedPrefixes) ? session.allowedPrefixes : []
  return expandAccessPrefixes(raw)
}

export function sessionCanAccessPrefix(session: Pick<AppServerSession, 'allowedPrefixes' | 'isAdmin' | 'groupId'>, prefix: string) {
  const allowed = getSessionAllowedPrefixes(session)
  return hasRequiredPrefixAccess(allowed, prefix)
}

export function sessionCanManageSensitiveGroupSettings(session: Pick<AppServerSession, 'allowedPrefixes' | 'isAdmin' | 'groupId'>) {
  const allowed = getSessionAllowedPrefixes(session)
  return allowed.includes('/') || allowed.includes('/group')
}
