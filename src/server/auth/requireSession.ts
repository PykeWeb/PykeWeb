import { getSessionFromRequest, type AppServerSession } from '@/server/auth/session'

export type { AppServerSession }

export async function requireSession(request?: Request): Promise<AppServerSession> {
  const session = await getSessionFromRequest(request)
  if (!session) throw new Error('Session invalide')
  return session
}

export async function requireGroupSession(request?: Request): Promise<AppServerSession> {
  const session = await requireSession(request)
  if (session.groupId === 'admin') throw new Error('Session groupe invalide')
  return session
}
