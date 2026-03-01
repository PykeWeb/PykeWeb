import { supabase } from '@/lib/supabaseClient'

export type ExpenseStatus = 'pending' | 'paid'

export type ExpenseItemType = 'object' | 'weapon' | 'equipment' | 'drug' | 'custom'

export type DbExpense = {
  id: string
  member_name: string
  item_type: ExpenseItemType
  item_ref_id?: string | null
  item_name: string
  unit_price: number
  quantity: number
  total_price: number
  description?: string | null
  proof_image_url?: string | null
  status: ExpenseStatus
  created_at: string
  paid_at?: string | null
}

const BUCKET = 'expense-proofs'

function getExt(file: File) {
  const byName = file.name.split('.').pop()?.toLowerCase()
  if (byName && byName.length <= 5) return byName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/webp') return 'webp'
  return 'png'
}

async function uploadProof(file: File): Promise<string> {
  const ext = getExt(file)
  const key = `batch/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(key, file, {
    upsert: true,
    contentType: file.type || undefined,
  })
  if (uploadError) throw uploadError
  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(key)
  return publicData.publicUrl
}

export async function listExpenses(): Promise<DbExpense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id,member_name,item_type,item_ref_id,item_name,unit_price,quantity,total_price,description,proof_image_url,status,created_at,paid_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as any
}

export async function createExpense(args: {
  member_name: string
  item_type: ExpenseItemType
  item_ref_id?: string | null
  item_name: string
  unit_price: number
  quantity: number
  description?: string
  proofFile?: File | null
}): Promise<DbExpense> {
  const total_price = Number(args.unit_price) * Number(args.quantity || 0)

  const { data: inserted, error: insertError } = await supabase
    .from('expenses')
    .insert({
      member_name: args.member_name,
      item_type: args.item_type,
      item_ref_id: args.item_ref_id || null,
      item_name: args.item_name,
      unit_price: args.unit_price,
      quantity: args.quantity,
      total_price,
      description: args.description || null,
      status: 'pending',
    })
    .select('id,member_name,item_type,item_ref_id,item_name,unit_price,quantity,total_price,description,proof_image_url,status,created_at,paid_at')
    .single()

  if (insertError) throw insertError
  if (!inserted) throw new Error('Insert failed')

  if (args.proofFile) {
    const ext = getExt(args.proofFile)
    const path = `${inserted.id}/proof.${ext}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, args.proofFile, {
      upsert: true,
      contentType: args.proofFile.type || undefined,
    })
    if (uploadError) throw uploadError

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const proof_image_url = publicData.publicUrl

    const { data: updated, error: updateError } = await supabase
      .from('expenses')
      .update({ proof_image_url })
      .eq('id', inserted.id)
      .select('id,member_name,item_type,item_ref_id,item_name,unit_price,quantity,total_price,description,proof_image_url,status,created_at,paid_at')
      .single()
    if (updateError) throw updateError
    return updated as any
  }

  return inserted as any
}

export async function createExpensesBulk(args: {
  member_name: string
  lines: {
    item_type: ExpenseItemType
    item_ref_id?: string | null
    item_name: string
    unit_price: number
    quantity: number
  }[]
  description?: string
  proofFile?: File | null
}): Promise<DbExpense[]> {
  const lines = (args.lines || []).filter((l) => l.quantity > 0)
  if (!lines.length) throw new Error('Aucun item sélectionné')

  const proof_image_url = args.proofFile ? await uploadProof(args.proofFile) : null

  const payload = lines.map((l) => ({
    member_name: args.member_name,
    item_type: l.item_type,
    item_ref_id: l.item_ref_id || null,
    item_name: l.item_name,
    unit_price: Number(l.unit_price),
    quantity: Number(l.quantity),
    total_price: Number(l.unit_price) * Number(l.quantity),
    description: args.description || null,
    proof_image_url,
    status: 'pending' as const,
  }))

  const { data, error } = await supabase
    .from('expenses')
    .insert(payload)
    .select('id,member_name,item_type,item_ref_id,item_name,unit_price,quantity,total_price,description,proof_image_url,status,created_at,paid_at')
  if (error) throw error
  return (data ?? []) as any
}

export async function setExpenseStatus(args: { expenseId: string; status: ExpenseStatus }) {
  const patch: any = { status: args.status }
  if (args.status === 'paid') patch.paid_at = new Date().toISOString()
  if (args.status === 'pending') patch.paid_at = null

  const { error } = await supabase.from('expenses').update(patch).eq('id', args.expenseId)
  if (error) throw error
}
