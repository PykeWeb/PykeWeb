import { supabase } from '@/lib/supabaseClient'

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

const TABLE = 'tenant_groups'

export async function listTenantGroups() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id,name,badge,login,password,active,paid_until,created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as TenantGroup[]
}

export async function createTenantGroup(input: Omit<TenantGroup, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(input)
    .select('id,name,badge,login,password,active,paid_until,created_at')
    .single()
  if (error) throw error
  return data as TenantGroup
}

export async function updateTenantGroup(id: string, patch: Partial<Omit<TenantGroup, 'id' | 'created_at'>>) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select('id,name,badge,login,password,active,paid_until,created_at')
    .single()
  if (error) throw error
  return data as TenantGroup
}

export async function deleteTenantGroup(id: string) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

export async function loginTenant(login: string, password: string) {
  const { data, error } = await supabase
    .from(TABLE)
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
