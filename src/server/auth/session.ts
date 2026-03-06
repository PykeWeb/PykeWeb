import { cookies, headers } from 'next/headers'
import {
  decodeTenantSession,
  isValidTenantSession,
  TENANT_SESSION_COOKIE_KEY,
  type TenantSessionPayload,
} from '@/lib/tenantSessionShared'

export type AppServerSession = TenantSessionPayload

export async function getSessionFromRequest(request?: Request): Promise<AppServerSession | null> {
  const rawCookie = (await cookies()).get(TENANT_SESSION_COOKIE_KEY)?.value
  if (rawCookie) {
    const decodedCookie = decodeTenantSession(rawCookie)
    if (isValidTenantSession(decodedCookie)) return decodedCookie
  }

  const headerValue = request?.headers.get('x-tenant-session') ?? (await headers()).get('x-tenant-session')
  if (!headerValue) return null
  const decodedHeader = decodeTenantSession(headerValue)
  return isValidTenantSession(decodedHeader) ? decodedHeader : null
}
