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
  const raw = JSON.stringify(session)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(raw, 'utf8').toString('base64url')
  }
  const bytes = new TextEncoder().encode(raw)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function decodeTenantSession(raw: string | undefined): TenantSessionPayload | null {
  if (!raw) return null
  try {
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(raw.length / 4) * 4, '=')
    const json = typeof Buffer !== 'undefined'
      ? Buffer.from(raw, 'base64url').toString('utf8')
      : new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)))
    return JSON.parse(json) as TenantSessionPayload
  } catch {
    return null
  }
}
