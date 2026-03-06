import { getTenantSession } from '@/lib/tenantSession'
import { encodeTenantSession } from '@/lib/tenantSessionShared'

export function withTenantSessionHeader(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers ?? undefined)

  if (typeof window !== 'undefined') {
    const session = getTenantSession()
    if (session) {
      headers.set('x-tenant-session', encodeTenantSession(session))
    }
  }

  return {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  }
}
