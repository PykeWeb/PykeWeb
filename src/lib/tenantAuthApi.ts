import { withTenantSessionHeader } from '@/lib/tenantRequest'

async function readApiError(res: Response) {
  try {
    const json = (await res.json()) as { error?: string }
    return json.error || 'Erreur API'
  } catch {
    return (await res.text()) || 'Erreur API'
  }
}

export type TenantGroup = {
  id: string
  name: string
  badge: string | null
  login: string
  password: string
  active: boolean
  paid_until: string | null
  created_at?: string
}

export async function listTenantGroups() {
  const res = await fetch('/api/admin/groups', withTenantSessionHeader({ cache: 'no-store' }))
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as TenantGroup[]
}

export async function createTenantGroup(input: Omit<TenantGroup, 'id' | 'created_at'>) {
  const res = await fetch('/api/admin/groups', {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as TenantGroup
}

export async function updateTenantGroup(id: string, patch: Partial<Omit<TenantGroup, 'id' | 'created_at'>>) {
  const res = await fetch('/api/admin/groups', {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'PUT',
    body: JSON.stringify({ id, patch }),
  })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()) as TenantGroup
}

export async function deleteTenantGroup(id: string) {
  const res = await fetch('/api/admin/groups', {
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error(await readApiError(res))
}

export async function loginTenant(login: string, password: string, remember = true) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ login, password, remember }),
  })
  if (!res.ok) throw new Error(await readApiError(res))
  const json = (await res.json()) as { group: TenantGroup }
  return json.group
}
