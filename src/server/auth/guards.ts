import { isAdminSession } from '@/lib/tenantSessionShared'
import { resolveServerSession, type ServerTenantSession } from '@/server/auth/session'

function ensureSession(session: ServerTenantSession | null): ServerTenantSession {
  if (!session) throw new Error('Session invalide')
  return session
}

export async function requireSession(request?: Request): Promise<ServerTenantSession> {
  return ensureSession(await resolveServerSession(request))
}

export async function requireAdmin(request?: Request): Promise<ServerTenantSession> {
  const session = ensureSession(await resolveServerSession(request))
  if (!isAdminSession(session)) throw new Error('Admin non autorisé')
  return session
}

export async function requireGroup(request?: Request): Promise<ServerTenantSession> {
  const session = ensureSession(await resolveServerSession(request))
  if (session.groupId === 'admin') throw new Error('Session groupe invalide')
  return session
}
