import { cookies } from 'next/headers'

type TenantSession = {
  v?: number
  groupId?: string
  groupName?: string
  isAdmin?: boolean
}

const COOKIE_KEY = 'tenant_session_v3'

export async function readTenantServerSession(): Promise<TenantSession | null> {
  const raw = (await cookies()).get(COOKIE_KEY)?.value
  if (!raw) return null
  try {
    const json = Buffer.from(raw, 'base64').toString('utf8')
    return JSON.parse(json) as TenantSession
  } catch {
    return null
  }
}

export async function requireAdminSession() {
  const session = await readTenantServerSession()
  if (!session || !(session.isAdmin || session.groupId === 'admin')) {
    throw new Error('Admin non autorisé')
  }
  return session
}

export async function requireGroupSession() {
  const session = await readTenantServerSession()
  if (!session?.groupId || session.groupId === 'admin') {
    throw new Error('Session groupe invalide')
  }
  return session
}
