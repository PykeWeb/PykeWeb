import { cookies } from 'next/headers'
import {
  decodeTenantSession,
  isValidTenantSession,
  TENANT_SESSION_COOKIE_KEY,
  type TenantSessionPayload,
} from '@/lib/tenantSessionShared'

export type AppServerSession = TenantSessionPayload

export async function getSessionFromRequest(_request?: Request): Promise<AppServerSession | null> {
  const raw = (await cookies()).get(TENANT_SESSION_COOKIE_KEY)?.value
  if (!raw) return null
  const decoded = decodeTenantSession(raw)
  return isValidTenantSession(decoded) ? decoded : null
}
