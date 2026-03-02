export type TenantSession = {
  groupId: string
  groupName: string
  groupBadge?: string | null
  isAdmin?: boolean
}

const STORAGE_KEY = 'pykeweb:tenant-session'
const COOKIE_KEY = 'tenant_session'

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

export function getTenantSession(): TenantSession | null {
  if (typeof window === 'undefined') return null

  const fromStorage = window.localStorage.getItem(STORAGE_KEY)
  if (fromStorage) {
    try {
      return JSON.parse(fromStorage) as TenantSession
    } catch {
      // ignore
    }
  }

  const cookieEntry = document.cookie
    .split('; ')
    .find((v) => v.startsWith(`${COOKIE_KEY}=`))
  const cookie = cookieEntry ? cookieEntry.slice(`${COOKIE_KEY}=`.length) : null
  if (!cookie) return null
  return decode(cookie)
}

export function saveTenantSession(session: TenantSession) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  const payload = encode(session)
  document.cookie = `${COOKIE_KEY}=${payload}; path=/; max-age=${60 * 60 * 24 * 14}; SameSite=Lax`
}

export function clearTenantSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`
}

export function requireTenantGroupId() {
  const s = getTenantSession()
  if (!s?.groupId) throw new Error('Aucun groupe actif. Connecte-toi.')
  return s.groupId
}
