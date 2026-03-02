import { supabase } from '@/lib/supabaseClient'
import { currentGroupId } from '@/lib/tenantScope'

const SUPPORT_BUCKET = 'expense-proofs'

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

function ext(file: File) {
  const e = file.name.split('.').pop()?.toLowerCase()
  if (e) return e
  return 'png'
}

export async function listActivePatchNotes(limit = 5): Promise<PatchNote[]> {
  const { data, error } = await supabase
    .from('patch_notes')
    .select('id,title,content,is_active,created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as PatchNote[]
}

export async function listPatchNotesAdmin(): Promise<PatchNote[]> {
  const { data, error } = await supabase
    .from('patch_notes')
    .select('id,title,content,is_active,created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PatchNote[]
}

export async function createPatchNote(input: { title: string; content: string; is_active: boolean }) {
  const { data, error } = await supabase
    .from('patch_notes')
    .insert({
      title: input.title,
      content: input.content,
      is_active: input.is_active,
    })
    .select('id,title,content,is_active,created_at')
    .single()
  if (error) throw error
  return data as PatchNote
}

export async function updatePatchNote(id: string, patch: Partial<Pick<PatchNote, 'title' | 'content' | 'is_active'>>) {
  const { data, error } = await supabase
    .from('patch_notes')
    .update(patch)
    .eq('id', id)
    .select('id,title,content,is_active,created_at')
    .single()
  if (error) throw error
  return data as PatchNote
}

export async function listSupportTicketsAdmin(kind: 'bug' | 'message') {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id,group_id,kind,message,image_url,status,created_at,tenant_groups(name,badge)')
    .eq('kind', kind)
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as Array<{
    id: unknown
    group_id: unknown
    kind: unknown
    message: unknown
    image_url: unknown
    status: unknown
    created_at: unknown
    tenant_groups?: unknown
  }>

  return rows.map((row) => ({
    id: String(row.id),
    group_id: String(row.group_id),
    kind: row.kind as SupportTicket['kind'],
    message: String(row.message ?? ''),
    image_url: (row.image_url ?? null) as string | null,
    status: row.status as SupportTicket['status'],
    created_at: String(row.created_at),
    tenant_groups: Array.isArray(row.tenant_groups)
      ? {
          name: (row.tenant_groups[0] as { name?: string | null } | undefined)?.name ?? null,
          badge: (row.tenant_groups[0] as { badge?: string | null } | undefined)?.badge ?? null,
        }
      : row.tenant_groups && typeof row.tenant_groups === 'object'
        ? {
            name: (row.tenant_groups as { name?: string | null }).name ?? null,
            badge: (row.tenant_groups as { badge?: string | null }).badge ?? null,
          }
        : null,
  }))
}

export async function createSupportTicket(input: { kind: 'bug' | 'message'; message: string; imageFile?: File | null }) {
  const groupId = currentGroupId()
  const { data: inserted, error: insertError } = await supabase
    .from('support_tickets')
    .insert({
      group_id: groupId,
      kind: input.kind,
      message: input.message,
      status: 'open',
    })
    .select('id,group_id,kind,message,image_url,status,created_at')
    .single()

  if (insertError) throw insertError
  if (!inserted) throw new Error('Insert failed')

  if (input.imageFile) {
    const path = `support/${input.kind}/${inserted.id}.${ext(input.imageFile)}`
    const { error: uploadError } = await supabase.storage.from(SUPPORT_BUCKET).upload(path, input.imageFile, {
      upsert: true,
      contentType: input.imageFile.type || undefined,
    })
    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabase.storage.from(SUPPORT_BUCKET).getPublicUrl(path)
    const { data: updated, error: updateError } = await supabase
      .from('support_tickets')
      .update({ image_url: publicUrlData.publicUrl })
      .eq('id', inserted.id)
      .select('id,group_id,kind,message,image_url,status,created_at')
      .single()
    if (updateError) throw updateError
    return updated as SupportTicket
  }

  return inserted as SupportTicket
}

export async function updateSupportTicketStatus(id: string, status: SupportTicket['status']) {
  const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id)
  if (error) throw error
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
