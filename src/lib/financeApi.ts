import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'

export type FinanceMovementType = 'expense' | 'purchase' | 'sale'
export type FinanceCategory = 'objects' | 'weapons' | 'equipment' | 'drugs' | 'custom' | 'other'

export type FinanceEntry = {
  id: string
  source: string
  movement_type: FinanceMovementType
  category: FinanceCategory
  item_label: string
  member_name: string | null
  quantity: number
  amount: number | null
  expense_status?: 'pending' | 'paid' | null
  payment_mode?: string | null
  notes?: string | null
  created_at: string
}

export async function listFinanceEntries(): Promise<FinanceEntry[]> {
  const groupId = currentGroupId()

  const [expensesRes, txRes, customTxRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('id,item_source,item_label,member_name,quantity,total,status,description,created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('transactions')
      .select('id,type,counterparty,total,notes,created_at,transaction_items(name_snapshot,quantity)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('finance_transactions')
      .select('id,mode,quantity,unit_price,total,counterparty,payment_mode,notes,created_at,catalog_items(name,category)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  if (expensesRes.error) throw expensesRes.error
  if (txRes.error) throw txRes.error
  if (customTxRes.error) throw customTxRes.error

  const entries: FinanceEntry[] = []

  for (const e of expensesRes.data ?? []) {
    entries.push({
      id: e.id,
      source: 'expenses',
      movement_type: 'expense',
      category: (e.item_source as FinanceCategory) || 'other',
      item_label: e.item_label,
      member_name: e.member_name,
      quantity: Number(e.quantity ?? 0),
      amount: Number(e.total ?? 0),
      expense_status: (e.status as 'pending' | 'paid') || 'pending',
      notes: e.description || null,
      created_at: e.created_at,
    })
  }

  for (const tx of txRes.data ?? []) {
    const itemName = (tx.transaction_items?.[0] as any)?.name_snapshot || 'Transaction'
    const qty = Number((tx.transaction_items?.[0] as any)?.quantity ?? 0) || 1
    entries.push({
      id: tx.id,
      source: 'transactions',
      movement_type: tx.type === 'purchase' ? 'purchase' : 'sale',
      category: 'objects',
      item_label: itemName,
      member_name: tx.counterparty,
      quantity: qty,
      amount: tx.total == null ? null : Number(tx.total),
      expense_status: null,
      notes: tx.notes,
      created_at: tx.created_at,
    })
  }

  for (const row of customTxRes.data ?? []) {
    const item = Array.isArray((row as any).catalog_items) ? (row as any).catalog_items[0] : (row as any).catalog_items
    entries.push({
      id: row.id,
      source: 'finance_transactions',
      movement_type: row.mode === 'buy' ? 'purchase' : 'sale',
      category: (item?.category as FinanceCategory) || 'other',
      item_label: item?.name || 'Item',
      member_name: row.counterparty,
      quantity: Number(row.quantity ?? 0),
      amount: Number(row.total ?? 0),
      expense_status: null,
      payment_mode: row.payment_mode,
      notes: row.notes,
      created_at: row.created_at,
    })
  }

  return entries.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
}
