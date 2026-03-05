import {
  isAdminSession,
  isValidTenantSession,
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

  return null
}

export function saveTenantSession(session: TenantSession) {
  if (typeof window === 'undefined') return
  const normalized: TenantSession = {
    ...session,
    v: SESSION_VERSION,
  }

  safeSetLocalStorage(STORAGE_KEY, JSON.stringify(normalized))
  clearLegacySessionArtifacts()
}

export async function clearTenantSessionOnServer() {
  await fetch('/api/auth/login', {
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
