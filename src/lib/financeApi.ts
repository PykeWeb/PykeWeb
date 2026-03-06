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
  expense_unit_price?: number | null
  payment_mode?: string | null
  notes?: string | null
  created_at: string
}

type TxJoinItem = { name_snapshot: string | null; quantity: number | null }
type FinanceTransactionJoinItem = { name: string | null; category: string | null }

export async function listFinanceEntries(): Promise<FinanceEntry[]> {
  const groupId = currentGroupId()

  const [expensesRes, txRes, customTxRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('id,item_source,item_label,member_name,quantity,total,unit_price,status,description,created_at')
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
      expense_unit_price: Number(e.unit_price ?? 0),
      created_at: e.created_at,
    })
  }

  for (const tx of txRes.data ?? []) {
    const txItems = (tx.transaction_items as TxJoinItem[] | null) ?? []
    const firstItem = txItems[0] ?? null
    const sameName = firstItem?.name_snapshot
      ? txItems.every((item) => (item.name_snapshot || '').trim().toLowerCase() === (firstItem.name_snapshot || '').trim().toLowerCase())
      : false
    const itemName = txItems.length > 1 && !sameName ? 'Multiple' : (firstItem?.name_snapshot || 'Transaction')
    const qty = txItems.reduce((sum, item) => sum + Math.max(0, Number(item.quantity ?? 0) || 0), 0) || 1
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
      expense_unit_price: null,
    })
  }

  for (const row of customTxRes.data ?? []) {
    const itemJoin = row.catalog_items as FinanceTransactionJoinItem[] | FinanceTransactionJoinItem | null
    const item = Array.isArray(itemJoin) ? (itemJoin[0] ?? null) : itemJoin

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
      expense_unit_price: null,
    })
  }

  return entries.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
}

export async function createFinanceTradeLog(args: {
  mode: 'buy' | 'sell'
  category: Exclude<FinanceCategory, 'other'>
  item_id: string
  item_name: string
  item_type?: string | null
  quantity: number
  unit_price: number
}) {
  const quantity = Math.max(1, Math.floor(args.quantity))
  const unitPrice = Math.max(0, Number(args.unit_price || 0))
  const { error } = await supabase.from('finance_trades').insert({
    group_id: currentGroupId(),
    mode: args.mode,
    category: args.category,
    item_id: args.item_id,
    item_name: args.item_name,
    item_type: args.item_type || null,
    quantity,
    unit_price: unitPrice,
    total: quantity * unitPrice,
  })
  if (error) throw error
}
