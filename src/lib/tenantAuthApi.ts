import { supabase } from '@/lib/supabase/client'

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
  const res = await fetch('/api/admin/groups', { cache: 'no-store' })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as TenantGroup[]
}

export async function createTenantGroup(input: Omit<TenantGroup, 'id' | 'created_at'>) {
  const res = await fetch('/api/admin/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as TenantGroup
}

export async function updateTenantGroup(id: string, patch: Partial<Omit<TenantGroup, 'id' | 'created_at'>>) {
  const res = await fetch('/api/admin/groups', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, patch }),
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as TenantGroup
}

export async function deleteTenantGroup(id: string) {
  const res = await fetch('/api/admin/groups', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function loginTenant(login: string, password: string) {
  const { data, error } = await supabase
    .from('tenant_groups')
    .select('id,name,badge,login,password,active,paid_until')
    .eq('login', login)
    .eq('password', password)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Identifiants invalides')
  if (!data.active) throw new Error('Groupe désactivé')
  if (data.paid_until && new Date(data.paid_until).getTime() < Date.now()) {
    throw new Error('Accès expiré (paiement en retard).')
  }

  return data as TenantGroup
}
