import { supabase } from '@/lib/supabaseClient'

export type ExpenseStatus = 'pending' | 'paid'

export type ExpenseItemType = 'objects' | 'weapons' | 'equipment' | 'drugs' | 'custom'

export type DbExpense = {
  id: string
  member_name: string
  item_source: ExpenseItemType
  item_id?: string | null
  item_label: string
  unit_price: number
  quantity: number
  total: number
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

export async function listExpenses(): Promise<DbExpense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id,member_name,item_source,item_id,item_label,unit_price,quantity,total,description,proof_image_url,status,created_at,paid_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as any
}

export async function createExpense(args: {
  member_name: string
  item_source: ExpenseItemType
  item_id?: string | null
  item_label: string
  unit_price: number
  quantity: number
  description?: string
  proofFile?: File | null
}): Promise<DbExpense> {
  const total = Number(args.unit_price) * Number(args.quantity || 0)

  const { data: inserted, error: insertError } = await supabase
    .from('expenses')
    .insert({
      member_name: args.member_name,
      item_source: args.item_source,
      item_id: args.item_id || null,
      item_label: args.item_label,
      unit_price: args.unit_price,
      quantity: args.quantity,
      total,
      description: args.description || null,
      status: 'pending',
    })
    .select('id,member_name,item_source,item_id,item_label,unit_price,quantity,total,description,proof_image_url,status,created_at,paid_at')
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
      .select('id,member_name,item_source,item_id,item_label,unit_price,quantity,total,description,proof_image_url,status,created_at,paid_at')
      .single()
    if (updateError) throw updateError
    return updated as any
  }

  return inserted as any
}

export async function setExpenseStatus(args: { expenseId: string; status: ExpenseStatus }) {
  const patch: any = { status: args.status }
  if (args.status === 'paid') patch.paid_at = new Date().toISOString()
  if (args.status === 'pending') patch.paid_at = null

  const { error } = await supabase.from('expenses').update(patch).eq('id', args.expenseId)
  if (error) throw error
}
