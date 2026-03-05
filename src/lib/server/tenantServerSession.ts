import { requireAdmin, requireGroup } from '@/server/auth/guards'
import { resolveServerSession, type ServerTenantSession } from '@/server/auth/session'

export type TenantSession = ServerTenantSession

export async function readTenantServerSession(): Promise<TenantSession | null> {
  return resolveServerSession()
}

export async function requireAdminSession(): Promise<TenantSession> {
  return requireAdmin()
}

export async function requireAdminSessionFromRequest(request: Request): Promise<TenantSession> {
  return requireAdmin(request)
}

export async function requireGroupSession(): Promise<TenantSession> {
  return requireGroup()
}
