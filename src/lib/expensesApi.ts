import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'
import { createAppLog } from '@/lib/logsApi'
import { resolveCatalogItemId } from '@/lib/itemsApi'

export type ExpenseStatus = 'pending' | 'paid'

export type ExpenseItemType = 'objects' | 'weapons' | 'equipment' | 'drugs' | 'custom'

export type DbExpense = {
  id: string
  member_name: string
  item_source: ExpenseItemType
  item_id?: string | null
  item_label: string
  unit_price: number
  unit_price_override?: number | null
  quantity: number
  total: number
  description?: string | null
  proof_image_url?: string | null
  status: ExpenseStatus
  created_at: string
  paid_at?: string | null
}

type ExpenseRow = {
  id: string
  member_name: string
  item_source: ExpenseItemType
  item_id?: string | null
  item_label: string
  unit_price: number | null
  unit_price_override?: number | null
  quantity: number | null
  total: number | null
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

function toNonNegative(value: number, fallback = 0) {
  const normalized = Number(value)
  if (!Number.isFinite(normalized)) return fallback
  return Math.max(0, normalized)
}

function normalizeExpenseRow(row: ExpenseRow): DbExpense {
  const quantity = Math.max(1, Math.floor(toNonNegative(row.quantity ?? 1, 1)))
  const unitPrice = toNonNegative(row.unit_price ?? 0)
  const computedTotal = toNonNegative(row.total ?? unitPrice * quantity)

  return {
    ...row,
    quantity,
    unit_price: unitPrice,
    total: computedTotal,
  }
}

export async function listExpenses(): Promise<DbExpense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id,member_name,item_source,item_id,item_label,unit_price,unit_price_override,quantity,total,description,proof_image_url,status,created_at,paid_at')
    .eq('group_id', currentGroupId())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => normalizeExpenseRow(row as ExpenseRow))
}

export async function createExpense(args: {
  member_name: string
  item_source: ExpenseItemType
  item_id?: string | null
  item_label: string
  unit_price: number
  default_unit_price?: number | null
  quantity: number
  description?: string
  proofFile?: File | null
}): Promise<DbExpense> {
  const resolvedItemId = args.item_id ? await resolveCatalogItemId(args.item_id) : null
  const normalizedUnitPrice = toNonNegative(args.unit_price)
  const defaultUnitPrice = toNonNegative(args.default_unit_price ?? normalizedUnitPrice)
  const normalizedQuantity = Math.max(1, Math.floor(toNonNegative(args.quantity, 1)))
  const hasOverride = Math.abs(normalizedUnitPrice - defaultUnitPrice) > 0.0001
  const total = normalizedUnitPrice * normalizedQuantity

  const { data: inserted, error: insertError } = await supabase
    .from('expenses')
    .insert({
      group_id: currentGroupId(),
      member_name: args.member_name,
      item_source: args.item_source,
      item_id: resolvedItemId,
      item_label: args.item_label,
      unit_price: normalizedUnitPrice,
      unit_price_override: hasOverride ? normalizedUnitPrice : null,
      quantity: normalizedQuantity,
      total,
      description: args.description || null,
      status: 'pending',
    })
    .select('id,member_name,item_source,item_id,item_label,unit_price,unit_price_override,quantity,total,description,proof_image_url,status,created_at,paid_at')
    .single<ExpenseRow>()

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
      .eq('group_id', currentGroupId())
      .select('id,member_name,item_source,item_id,item_label,unit_price,unit_price_override,quantity,total,description,proof_image_url,status,created_at,paid_at')
      .single<ExpenseRow>()
    if (updateError) throw updateError
    if (!updated) throw new Error('Update failed')
    const normalized = normalizeExpenseRow(updated)
    void createAppLog({
      area: 'finance.expenses',
      action: 'create',
      message: `Nouvelle dépense: ${normalized.item_label} (${normalized.total.toFixed(2)} $)`,
      entity_type: 'expense',
      entity_id: normalized.id,
      payload: { quantity: normalized.quantity, unit_price: normalized.unit_price, total: normalized.total },
    })
    return normalized
  }
  const normalized = normalizeExpenseRow(inserted)
  void createAppLog({
    area: 'finance.expenses',
    action: 'create',
    message: `Nouvelle dépense: ${normalized.item_label} (${normalized.total.toFixed(2)} $)`,
    entity_type: 'expense',
    entity_id: normalized.id,
    payload: { quantity: normalized.quantity, unit_price: normalized.unit_price, total: normalized.total },
  })
  return normalized
}

export async function updateExpense(args: {
  expenseId: string
  member_name: string
  item_label: string
  quantity: number
  unit_price: number
  description?: string | null
}) {
  const quantity = Math.max(1, Math.floor(toNonNegative(args.quantity, 1)))
  const unit_price = toNonNegative(args.unit_price)
  const total = quantity * unit_price

  const { error } = await supabase
    .from('expenses')
    .update({
      member_name: args.member_name.trim(),
      item_label: args.item_label.trim(),
      quantity,
      unit_price,
      total,
      description: args.description?.trim() || null,
    })
    .eq('id', args.expenseId)
    .eq('group_id', currentGroupId())

  if (error) throw error
  void createAppLog({
    area: 'finance.expenses',
    action: 'update',
    message: `Dépense modifiée: ${args.item_label.trim()} (${total.toFixed(2)} $)`,
    entity_type: 'expense',
    entity_id: args.expenseId,
    payload: { quantity, unit_price, total },
  })
}

export async function setExpenseStatus(args: { expenseId: string; status: ExpenseStatus }) {
  const patch: { status: ExpenseStatus; paid_at: string | null } = {
    status: args.status,
    paid_at: args.status === 'paid' ? new Date().toISOString() : null,
  }

  const { error } = await supabase.from('expenses').update(patch).eq('id', args.expenseId).eq('group_id', currentGroupId())
  if (error) throw error
  void createAppLog({
    area: 'finance.expenses',
    action: 'status',
    message: `Statut dépense: ${args.status === 'paid' ? 'Remboursé' : 'En attente'}`,
    entity_type: 'expense',
    entity_id: args.expenseId,
    payload: { status: args.status },
  })
}

export async function deleteExpense(expenseId: string) {
  const groupId = currentGroupId()
  const scopedDelete = await supabase.from('expenses').delete().eq('id', expenseId).eq('group_id', groupId).select('id')
  if (scopedDelete.error) throw scopedDelete.error

  if (!scopedDelete.data || scopedDelete.data.length === 0) {
    const legacyFallback = await supabase.from('expenses').delete().eq('id', expenseId).is('group_id', null).select('id')
    if (legacyFallback.error) throw legacyFallback.error
    if (!legacyFallback.data || legacyFallback.data.length === 0) {
      throw new Error('Dépense introuvable ou déjà supprimée.')
    }
  }

  void createAppLog({
    area: 'finance.expenses',
    action: 'delete',
    message: 'Dépense supprimée',
    entity_type: 'expense',
    entity_id: expenseId,
  })
}
