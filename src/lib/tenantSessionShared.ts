export type TenantSessionPayload = {
  v?: number
  groupId: string
  groupName: string
  groupBadge?: string | null
  isAdmin?: boolean
}

export const TENANT_SESSION_VERSION = 3
export const TENANT_SESSION_COOKIE_KEY = 'tenant_session_v3'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidTenantSession(session: TenantSessionPayload | null): session is TenantSessionPayload {
  if (!session?.groupId || typeof session.groupId !== 'string') return false
  if (!session.groupName || !session.groupName.trim()) return false
  if ((session.v ?? 0) !== TENANT_SESSION_VERSION) return false
  if (session.groupId === 'admin') return true
  return UUID_RE.test(session.groupId)
}

export function isAdminSession(session: Pick<TenantSessionPayload, 'groupId' | 'isAdmin'> | null | undefined) {
  return Boolean(session?.isAdmin || session?.groupId === 'admin')
}

export function encodeTenantSession(session: TenantSessionPayload) {
  return btoa(JSON.stringify(session))
}

export function decodeTenantSession(raw: string | undefined): TenantSessionPayload | null {
  if (!raw) return null
  try {
    return JSON.parse(atob(raw)) as TenantSessionPayload
  } catch {
    return null
  }
}

