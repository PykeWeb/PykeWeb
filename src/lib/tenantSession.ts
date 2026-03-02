export type TenantSession = {
  groupId: string
  groupName: string
  groupBadge?: string | null
  isAdmin?: boolean
}

const STORAGE_KEY = 'pykeweb:tenant-session:v2'
const LEGACY_STORAGE_KEYS = ['pykeweb:tenant-session', 'pykeweb:tenant-session:v1']
const COOKIE_KEY = 'tenant_session_v2'
const LEGACY_COOKIE_KEYS = ['tenant_session']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function decode(raw: string): TenantSession | null {
  try {
    const json = window.atob(raw)
    return JSON.parse(json) as TenantSession
  } catch {
    return null
  }
}

function encode(session: TenantSession) {
  return window.btoa(JSON.stringify(session))
}

function isValidSession(session: TenantSession | null): session is TenantSession {
  if (!session?.groupId || typeof session.groupId !== 'string') return false
  if (session.groupId === 'admin') return true
  return UUID_RE.test(session.groupId)
}

function clearLegacySessionArtifacts() {
  LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key))
  LEGACY_COOKIE_KEYS.forEach((key) => {
    document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`
  })
}

export function getTenantSession(): TenantSession | null {
  if (typeof window === 'undefined') return null

  const fromStorage = window.localStorage.getItem(STORAGE_KEY)
  if (fromStorage) {
    try {
      const parsed = JSON.parse(fromStorage) as TenantSession
      if (isValidSession(parsed)) return parsed
    } catch {
      // ignore
    }
  }

  const cookieEntry = document.cookie
    .split('; ')
    .find((v) => v.startsWith(`${COOKIE_KEY}=`))
  const cookie = cookieEntry ? cookieEntry.slice(`${COOKIE_KEY}=`.length) : null
  if (!cookie) return null

  const decoded = decode(cookie)
  if (!isValidSession(decoded)) {
    clearTenantSession()
    return null
  }

  return decoded
}

export function saveTenantSession(session: TenantSession) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  clearLegacySessionArtifacts()
  const payload = encode(session)
  document.cookie = `${COOKIE_KEY}=${payload}; path=/; max-age=${60 * 60 * 24 * 14}; SameSite=Lax`
}

export function clearTenantSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  clearLegacySessionArtifacts()
  document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`
}

export function requireTenantGroupId() {
  const s = getTenantSession()
  if (!s?.groupId) throw new Error('Aucun groupe actif. Connecte-toi.')
  if (s.groupId === 'admin') throw new Error('Compte admin: ouvre Admin groupes pour gérer les groupes.')
  if (!UUID_RE.test(s.groupId)) throw new Error('Session invalide. Reconnecte-toi.')
  return s.groupId
}
