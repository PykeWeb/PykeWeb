import {
  decodeTenantSession,
  encodeTenantSession,
  isAdminSession,
  isValidTenantSession,
  TENANT_SESSION_COOKIE_KEY,
  TENANT_SESSION_VERSION,
  type TenantSessionPayload,
} from '@/lib/tenantSessionShared'

export type TenantSession = TenantSessionPayload

export function isAdminTenantSession(session: TenantSession | null | undefined) {
  return isAdminSession(session)
}

const SESSION_VERSION = TENANT_SESSION_VERSION
const STORAGE_KEY = 'pykeweb:tenant-session:v3'
const LEGACY_STORAGE_KEYS = ['pykeweb:tenant-session', 'pykeweb:tenant-session:v1', 'pykeweb:tenant-session:v2']
const COOKIE_KEY = TENANT_SESSION_COOKIE_KEY
const LEGACY_COOKIE_KEYS = ['tenant_session', 'tenant_session_v2']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isValidSession = isValidTenantSession

function isProd() {
  return process.env.NODE_ENV === 'production'
}

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
    // ignore storage limitations (CEF private contexts, disabled localStorage, quota)
  }
}

function safeRemoveLocalStorage(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore storage limitations
  }
}

function legacyClearCookieString(name: string) {
  // Clearing cookies in embedded contexts sometimes requires matching SameSite/Secure
  // We'll clear both "Lax" and "None; Secure" forms to be safe.
  const base = `${name}=; path=/; max-age=0`
  const clears = [
    `${base}; SameSite=Lax`,
    `${base}; SameSite=None; Secure`,
  ]
  clears.forEach((c) => { document.cookie = c })
}

function clearLegacySessionArtifacts() {
  LEGACY_STORAGE_KEYS.forEach((key) => safeRemoveLocalStorage(key))
  LEGACY_COOKIE_KEYS.forEach((key) => legacyClearCookieString(key))
}

function getClientCookieAttrs() {
  // FiveM / CEF: in prod the cookie often behaves like 3rd-party in an embed context,
  // so we need SameSite=None; Secure (requires HTTPS).
  if (isProd()) return `SameSite=None; Secure`
  return `SameSite=Lax`
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

export function saveTenantSession(session: TenantSession) {
  if (typeof window === 'undefined') return
  const normalized: TenantSession = {
    ...session,
    v: SESSION_VERSION,
  }

  safeSetLocalStorage(STORAGE_KEY, JSON.stringify(normalized))
  clearLegacySessionArtifacts()

  const payload = encodeTenantSession(normalized)
  const maxAge = 60 * 60 * 24 * 14
  document.cookie = `${COOKIE_KEY}=${payload}; path=/; max-age=${maxAge}; ${getClientCookieAttrs()}`
}

export async function syncTenantSessionToServer(session: TenantSession) {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ session }),
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
  // Also clear current cookie key in both variants
  legacyClearCookieString(COOKIE_KEY)
}

export function requireTenantGroupId() {
  const s = getTenantSession()
  if (!s?.groupId) throw new Error('Aucun groupe actif. Connecte-toi.')
  if (s.groupId === 'admin') throw new Error('Compte admin: ouvre Admin groupes pour gérer les groupes.')
  if (!UUID_RE.test(s.groupId)) throw new Error('Session invalide. Reconnecte-toi.')
  return s.groupId
}
