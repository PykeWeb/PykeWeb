import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'

export type PatchNote = {
  id: string
  title: string
  content: string
  is_active: boolean
  created_at: string
}

export type SupportTicket = {
  id: string
  group_id: string
  kind: 'bug' | 'message'
  message: string
  image_url: string | null
  status: 'open' | 'in_progress' | 'resolved'
  created_at: string
  tenant_groups?: { name: string | null; badge: string | null } | null
}

export async function listActivePatchNotes(limit = 5): Promise<PatchNote[]> {
  const res = await fetch(`/api/patch-notes?limit=${limit}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Impossible de charger les patch notes')
  return (await res.json()) as PatchNote[]
}

export async function listPatchNotesAdmin(): Promise<PatchNote[]> {
  const res = await fetch('/api/admin/patch-notes', { cache: 'no-store' })
  if (!res.ok) throw new Error('Impossible de charger les patch notes admin')
  return (await res.json()) as PatchNote[]
}

export async function createPatchNote(input: { title: string; content: string; is_active: boolean }) {
  const res = await fetch('/api/admin/patch-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as PatchNote
}

export async function updatePatchNote(id: string, patch: Partial<Pick<PatchNote, 'title' | 'content' | 'is_active'>>) {
  const res = await fetch('/api/admin/patch-notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, patch }),
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as PatchNote
}

export async function deletePatchNote(id: string) {
  const res = await fetch('/api/admin/patch-notes', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function listSupportTicketsAdmin(kind: 'bug' | 'message', includeResolved = false) {
  const res = await fetch(`/api/admin/support-tickets?kind=${kind}&includeResolved=${includeResolved ? '1' : '0'}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Impossible de charger les tickets')
  const rows = (await res.json()) as any[]
  return rows.map((row) => ({
    ...row,
    tenant_groups: Array.isArray(row.tenant_groups)
      ? {
          name: row.tenant_groups[0]?.name ?? null,
          badge: row.tenant_groups[0]?.badge ?? null,
        }
      : row.tenant_groups ?? null,
  })) as SupportTicket[]
}

export async function createSupportTicket(input: { kind: 'bug' | 'message'; message: string; imageFile?: File | null }) {
  const formData = new FormData()
  formData.append('kind', input.kind)
  formData.append('message', input.message)
  if (input.imageFile) formData.append('image', input.imageFile)

  const res = await fetch('/api/support/tickets', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as SupportTicket
}

export async function updateSupportTicketStatus(id: string, status: SupportTicket['status']) {
  const res = await fetch('/api/admin/support-tickets', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function getCurrentGroupAccessInfo() {
  const groupId = currentGroupId()
  const { data, error } = await supabase
    .from('tenant_groups')
    .select('id,name,paid_until,active')
    .eq('id', groupId)
    .maybeSingle()
  if (error) throw error
  return data as { id: string; name: string; paid_until: string | null; active: boolean } | null
}
