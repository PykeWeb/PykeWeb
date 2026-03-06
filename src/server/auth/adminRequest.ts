import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertAdminSession } from '@/server/auth/admin'

type AdminGroupRow = {
  id: string
  login: string
  password: string
  active: boolean
  badge: string | null
  name: string
}

function isAdminGroup(row: Pick<AdminGroupRow, 'login' | 'badge' | 'name'>) {
  return row.login.trim().toLowerCase() === 'admin'
    || (row.badge || '').trim().toLowerCase() === 'admin'
    || row.name.trim().toLowerCase() === 'administration'
}

export async function isValidAdminCredentials(username: string, password: string) {
  const login = username.trim()
  const secret = password.trim()
  if (!login || !secret) return false

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tenant_groups')
    .select('id,login,password,active,badge,name')
    .eq('login', login)
    .eq('password', secret)
    .maybeSingle<AdminGroupRow>()

  if (error || !data || !data.active) return false
  return isAdminGroup(data)
}

export async function isValidAdminCredentialHeaders(request: Request) {
  const username = (request.headers.get('x-admin-user') || '').trim()
  const password = (request.headers.get('x-admin-password') || '').trim()
  if (!username || !password) return false
  return isValidAdminCredentials(username, password)
}

export async function assertAdminRequestAuthorized(request: Request) {
  try {
    await assertAdminSession(request)
    return
  } catch {
    // fallback for environments where session cookies are not forwarded consistently (CEF/FiveM)
  }

  const hasValidHeaderCredentials = await isValidAdminCredentialHeaders(request)
  if (!hasValidHeaderCredentials) {
    throw new Error('Admin non autorisé')
  }
}
