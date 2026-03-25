import {
  decodeTenantSession,
  encodeTenantSession,
  isAdminSession,
  isMemberSession,
  isValidTenantSession,
  TENANT_SESSION_COOKIE_KEY,
  TENANT_SESSION_VERSION,
  type TenantSessionPayload,
} from '@/lib/tenantSessionShared'

export type TenantSession = TenantSessionPayload

export function isAdminTenantSession(session: TenantSession | null | undefined) {
  return isAdminSession(session)
}

export function isMemberTenantSession(session: TenantSession | null | undefined) {
  return isMemberSession(session)
}

export function isSbTenantSession(session: TenantSession | null | undefined) {
  const groupBadge = String(session?.groupBadge || '').trim().toLowerCase()
  if (groupBadge === 'sb') return true

  const groupName = String(session?.groupName || '').trim().toLowerCase()
  return groupName.includes('santa blanca')
}

const SESSION_VERSION = TENANT_SESSION_VERSION
const STORAGE_KEY = 'pykeweb:tenant-session:v4'
const LEGACY_STORAGE_KEYS = ['pykeweb:tenant-session', 'pykeweb:tenant-session:v1', 'pykeweb:tenant-session:v2', 'pykeweb:tenant-session:v3']
const COOKIE_KEY = TENANT_SESSION_COOKIE_KEY
const LEGACY_COOKIE_KEYS = ['tenant_session', 'tenant_session_v2', 'tenant_session_v3']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isValidSession = isValidTenantSession

function safeGetLocalStorage(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore storage limitations
  }
}

function safeRemoveLocalStorage(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore storage limitations
  }
}

function clearLegacySessionArtifacts() {
  LEGACY_STORAGE_KEYS.forEach((key) => safeRemoveLocalStorage(key))
  LEGACY_COOKIE_KEYS.forEach((key) => {
    document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`
  })
}

export function getTenantSession(): TenantSession | null {
  if (typeof window === 'undefined') return null

  const fromStorage = safeGetLocalStorage(STORAGE_KEY)
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

  const decoded = decodeTenantSession(cookie)
  if (!isValidSession(decoded)) {
    clearTenantSession()
    return null
  }

  return decoded
}

export function saveTenantSession(session: TenantSession, remember = true) {
  if (typeof window === 'undefined') return
  const normalized: TenantSession = {
    ...session,
    v: SESSION_VERSION,
  }

  safeSetLocalStorage(STORAGE_KEY, JSON.stringify(normalized))
  clearLegacySessionArtifacts()
  const payload = encodeTenantSession(normalized)
  const rememberDirective = remember ? `max-age=${60 * 60 * 24 * 14}; ` : ''
  document.cookie = `${COOKIE_KEY}=${payload}; path=/; ${rememberDirective}SameSite=Lax`
}

export async function syncTenantSessionToServer(session: TenantSession, remember = true) {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ session, remember }),
  })
  if (!res.ok) {
    throw new Error('Synchronisation de session impossible')
  }
}

export async function clearTenantSessionOnServer() {
  await fetch('/api/auth/session', {
    method: 'DELETE',
    credentials: 'include',
  })
}

export function clearTenantSession() {
  if (typeof window === 'undefined') return
  safeRemoveLocalStorage(STORAGE_KEY)
  clearLegacySessionArtifacts()
}

export function requireTenantGroupId() {
  const s = getTenantSession()
  if (!s?.groupId) throw new Error('Aucun groupe actif. Connecte-toi.')
  if (s.groupId === 'admin') throw new Error('Compte admin: ouvre Admin groupes pour gérer les groupes.')
  if (!UUID_RE.test(s.groupId)) throw new Error('Session invalide. Reconnecte-toi.')
  return s.groupId
}
