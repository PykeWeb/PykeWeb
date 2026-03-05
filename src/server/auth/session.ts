import { cookies } from 'next/headers'
import {
  decodeTenantSession,
  isValidTenantSession,
  TENANT_SESSION_COOKIE_KEY,
  type TenantSessionPayload,
} from '@/lib/tenantSessionShared'

export type ServerTenantSession = TenantSessionPayload

export async function readServerSessionFromCookie(): Promise<ServerTenantSession | null> {
  const raw = (await cookies()).get(TENANT_SESSION_COOKIE_KEY)?.value
  if (!raw) return null
  const decoded = decodeTenantSession(raw)
  return isValidTenantSession(decoded) ? decoded : null
}

export function readServerSessionFromHeader(request: Request): ServerTenantSession | null {
  const raw = request.headers.get('x-tenant-session') || undefined
  if (!raw) return null
  const decoded = decodeTenantSession(raw)
  return isValidTenantSession(decoded) ? decoded : null
}

export async function resolveServerSession(request?: Request): Promise<ServerTenantSession | null> {
  if (request) {
    const fromHeader = readServerSessionFromHeader(request)
    if (fromHeader) return fromHeader
  }
  return readServerSessionFromCookie()
}
