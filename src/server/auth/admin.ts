import { isAdminSession } from '@/lib/tenantSessionShared'
import { requireSession, type AppServerSession } from '@/server/auth/requireSession'

export type AdminSession = AppServerSession

export async function assertAdminSession(request?: Request): Promise<AdminSession> {
  const session = await requireSession(request)
  if (!isAdminSession(session)) throw new Error('Admin non autorisé')
  return session
}
