import { cookies } from 'next/headers'
import {
  decodeTenantSession,
  isAdminSession,
  isValidTenantSession,
  TENANT_SESSION_COOKIE_KEY,
  type TenantSessionPayload,
} from '@/lib/tenantSessionShared'

type TenantSession = TenantSessionPayload

export async function readTenantServerSession(): Promise<TenantSession | null> {
  const raw = (await cookies()).get(TENANT_SESSION_COOKIE_KEY)?.value
  if (!raw) return null
  const decoded = decodeTenantSession(raw)
  return isValidTenantSession(decoded) ? decoded : null
}

function readTenantSessionFromRequest(request: Request) {
  const raw = request.headers.get('x-tenant-session') || undefined
  if (!raw) return null
  const decoded = decodeTenantSession(raw)
  return isValidTenantSession(decoded) ? decoded : null
}

function assertAdminSession(session: TenantSession | null): TenantSession {
  if (!session || !isAdminSession(session)) {
    throw new Error('Admin non autorisé')
  }
  return session
}

export async function requireAdminSession(): Promise<TenantSession> {
  return assertAdminSession(await readTenantServerSession())
}

export async function requireAdminSessionFromRequest(request: Request): Promise<TenantSession> {
  const fromRequest = readTenantSessionFromRequest(request)
  const session = fromRequest ?? (await readTenantServerSession())
  return assertAdminSession(session)
}

export async function requireGroupSession() {
  const session = await readTenantServerSession()
  if (!session?.groupId || session.groupId === 'admin') {
    throw new Error('Session groupe invalide')
  }
  return session
}
