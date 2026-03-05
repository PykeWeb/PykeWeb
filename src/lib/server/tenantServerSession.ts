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

// Fonction utilitaire pour assertion
function assertAdminSession(session: TenantSession | null): TenantSession {
  if (!session || !isAdminSession(session)) {
    throw new Error('Admin non autorisé')
  }
  return session
}

// Version principale utilisant assertAdminSession
export async function requireAdminSession(): Promise<TenantSession> {
  return assertAdminSession(await readTenantServerSession())
}

// Version avec Request pour les API routes
export async function requireAdminSessionFromRequest(request: Request): Promise<TenantSession> {
  const cookiesHeader = request.headers.get('cookie')
  const raw = cookiesHeader?.split('; ')
    .find(c => c.startsWith(`${TENANT_SESSION_COOKIE_KEY}=`))
    ?.split('=')[1]
  
  if (!raw) {
    return requireAdminSession() // Fallback aux cookies du serveur
  }
  
  const decoded = decodeTenantSession(raw)
  return assertAdminSession(isValidTenantSession(decoded) ? decoded : null)
}

// Pour les sessions groupe (non-admin)
export async function requireGroupSession() {
  const session = await readTenantServerSession()
  if (!session?.groupId || session.groupId === 'admin') {
    throw new Error('Session groupe invalide')
  }
  return session
}
