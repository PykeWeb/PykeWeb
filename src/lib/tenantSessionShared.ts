export type TenantRole = string

export type TenantSessionPayload = {
  v?: number
  groupId: string
  groupName: string
  groupBadge?: string | null
  groupLogoUrl?: string | null
  isAdmin?: boolean
  memberId?: string
  role?: TenantRole
  roleLabel?: string
  memberName?: string
  allowedPrefixes?: string[]
}

export const TENANT_SESSION_VERSION = 5
export const TENANT_SESSION_COOKIE_KEY = 'tenant_session_v4'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidTenantSession(session: TenantSessionPayload | null): session is TenantSessionPayload {
  if (!session?.groupId || typeof session.groupId !== 'string') return false
  if (!session.groupName || !session.groupName.trim()) return false
  if ((session.v ?? 0) !== TENANT_SESSION_VERSION) return false

  if (session.role && typeof session.role !== 'string') return false
  if (session.memberId && typeof session.memberId !== 'string') return false
  if (session.roleLabel && typeof session.roleLabel !== 'string') return false
  if (session.memberName && typeof session.memberName !== 'string') return false
  if (session.allowedPrefixes && !Array.isArray(session.allowedPrefixes)) return false
  if (Array.isArray(session.allowedPrefixes) && session.allowedPrefixes.some((entry) => typeof entry !== 'string')) return false

  if (session.groupId === 'admin') return true

  return UUID_RE.test(session.groupId)
}

export function isAdminSession(session: Pick<TenantSessionPayload, 'groupId' | 'isAdmin'> | null | undefined) {
  return Boolean(session?.isAdmin || session?.groupId === 'admin')
}

export function isMemberSession(session: Pick<TenantSessionPayload, 'role' | 'groupId' | 'isAdmin'> | null | undefined) {
  return Boolean(session && !isAdminSession(session) && session.role === 'member')
}

export function encodeTenantSession(session: TenantSessionPayload) {
  const raw = JSON.stringify(session)
  try {
    const bytes = new TextEncoder().encode(raw)
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
    return btoa(binary)
  } catch {
    // fallback for runtimes without TextEncoder
    const BufferCtor = (globalThis as { Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer
    if (BufferCtor) return BufferCtor.from(raw, 'utf8').toString('base64')
    return btoa(raw)
  }
}

export function decodeTenantSession(raw: string | undefined): TenantSessionPayload | null {
  if (!raw) return null
  try {
    const binary = atob(raw)
    try {
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      const decoded = new TextDecoder().decode(bytes)
      return JSON.parse(decoded) as TenantSessionPayload
    } catch {
      const BufferCtor = (globalThis as { Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer
      if (BufferCtor) return JSON.parse(BufferCtor.from(raw, 'base64').toString('utf8')) as TenantSessionPayload
      return JSON.parse(binary) as TenantSessionPayload
    }
  } catch {
    return null
  }
}
