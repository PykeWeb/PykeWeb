import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'
import { isStockInNote, stripStockFlowMarker } from '@/lib/financeStockFlow'

export type FinanceMovementType = 'expense' | 'purchase' | 'stock_in' | 'sale' | 'stock_out'
export type FinanceCategory = 'objects' | 'weapons' | 'equipment' | 'drugs' | 'custom' | 'other'

export type FinanceEntry = {
  id: string
  source: string
  movement_type: FinanceMovementType
  category: FinanceCategory
  item_label: string
  item_image_url?: string | null
  is_multi?: boolean
  member_name: string | null
  quantity: number
  amount: number | null
  expense_status?: 'pending' | 'paid' | null
  expense_unit_price?: number | null
  payment_mode?: string | null
  notes?: string | null
  created_at: string
}

type TxJoinItem = { name_snapshot: string | null; quantity: number | null; image_url_snapshot?: string | null }
type FinanceTransactionJoinItem = { name: string | null; category: string | null; image_url: string | null }
type FinanceTransactionRow = {
  id: string
  mode: 'buy' | 'sell'
  quantity: number | null
  unit_price: number | null
  total: number | null
  counterparty: string | null
  payment_mode: string | null
  notes: string | null
  created_at: string
  catalog_items: FinanceTransactionJoinItem[] | FinanceTransactionJoinItem | null
}

function isMissingImageSnapshotColumn(errorMessage: string | null | undefined) {
  const msg = String(errorMessage || '').toLowerCase()
  return msg.includes('image_url_snapshot') || msg.includes('column')
}

async function listTransactionsWithOptionalImageSnapshot(groupId: string) {
  const withSnapshot = await supabase
    .from('transactions')
    .select('id,type,counterparty,total,notes,created_at,transaction_items(name_snapshot,quantity,image_url_snapshot)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (!withSnapshot.error) {
    return withSnapshot
  }

  if (!isMissingImageSnapshotColumn(withSnapshot.error.message)) {
    return withSnapshot
  }

  const fallback = await supabase
    .from('transactions')
    .select('id,type,counterparty,total,notes,created_at,transaction_items(name_snapshot,quantity)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(500)

  return fallback
}

export async function listFinanceEntries(): Promise<FinanceEntry[]> {
  const groupId = currentGroupId()

  const [expensesRes, txRes, customTxRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('id,item_source,item_id,item_label,member_name,quantity,total,unit_price,status,description,created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(500),
    listTransactionsWithOptionalImageSnapshot(groupId),
    supabase
      .from('finance_transactions')
      .select('id,mode,quantity,unit_price,total,counterparty,payment_mode,notes,created_at,catalog_items(name,category,image_url)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  if (expensesRes.error) throw expensesRes.error
  if (txRes.error) throw txRes.error
  if (customTxRes.error) throw customTxRes.error

  const expenseRows = expensesRes.data ?? []
  const objectIds = expenseRows.filter((row) => row.item_source === 'objects' && row.item_id).map((row) => row.item_id as string)
  const weaponIds = expenseRows.filter((row) => row.item_source === 'weapons' && row.item_id).map((row) => row.item_id as string)
  const equipmentIds = expenseRows.filter((row) => row.item_source === 'equipment' && row.item_id).map((row) => row.item_id as string)
  const drugIds = expenseRows.filter((row) => row.item_source === 'drugs' && row.item_id).map((row) => row.item_id as string)

  const [objectsRes, weaponsRes, equipmentRes, drugsRes] = await Promise.all([
    objectIds.length > 0 ? supabase.from('objects').select('id,image_url').eq('group_id', groupId).in('id', objectIds) : Promise.resolve({ data: [], error: null }),
    weaponIds.length > 0 ? supabase.from('weapons').select('id,image_url').eq('group_id', groupId).in('id', weaponIds) : Promise.resolve({ data: [], error: null }),
    equipmentIds.length > 0 ? supabase.from('equipment').select('id,image_url').eq('group_id', groupId).in('id', equipmentIds) : Promise.resolve({ data: [], error: null }),
    drugIds.length > 0 ? supabase.from('drug_items').select('id,image_url').eq('group_id', groupId).in('id', drugIds) : Promise.resolve({ data: [], error: null }),
  ])

  if (objectsRes.error) throw objectsRes.error
  if (weaponsRes.error) throw weaponsRes.error
  if (equipmentRes.error) throw equipmentRes.error
  if (drugsRes.error) throw drugsRes.error

  const expenseImageMap = new Map<string, string | null>()
  for (const row of objectsRes.data ?? []) expenseImageMap.set(`objects:${(row as { id: string }).id}`, (row as { image_url: string | null }).image_url)
  for (const row of weaponsRes.data ?? []) expenseImageMap.set(`weapons:${(row as { id: string }).id}`, (row as { image_url: string | null }).image_url)
  for (const row of equipmentRes.data ?? []) expenseImageMap.set(`equipment:${(row as { id: string }).id}`, (row as { image_url: string | null }).image_url)
  for (const row of drugsRes.data ?? []) expenseImageMap.set(`drugs:${(row as { id: string }).id}`, (row as { image_url: string | null }).image_url)

  const entries: FinanceEntry[] = []

  for (const e of expenseRows) {
    const expenseKey = e.item_id ? `${e.item_source}:${e.item_id}` : null
    entries.push({
      id: e.id,
      source: 'expenses',
      movement_type: 'expense',
      category: (e.item_source as FinanceCategory) || 'other',
      item_label: e.item_label,
      item_image_url: expenseKey ? expenseImageMap.get(expenseKey) ?? null : null,
      is_multi: e.item_label.trim().toLowerCase().startsWith('multiple'),
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
    const firstImage = txItems.find((item) => typeof item.image_url_snapshot === 'string' && item.image_url_snapshot)?.image_url_snapshot || null
    entries.push({
      id: tx.id,
      source: 'transactions',
      movement_type: tx.type === 'purchase' ? 'purchase' : 'sale',
      category: 'objects',
      item_label: itemName,
      item_image_url: txItems.length > 1 ? null : firstImage,
      is_multi: txItems.length > 1,
      member_name: tx.counterparty,
      quantity: qty,
      amount: tx.total == null ? null : Number(tx.total),
      expense_status: null,
      notes: tx.notes,
      created_at: tx.created_at,
      expense_unit_price: null,
    })
  }

  const financeRows = ((customTxRes.data ?? []) as FinanceTransactionRow[]).map((row) => {
    const itemJoin = row.catalog_items
    const item = Array.isArray(itemJoin) ? (itemJoin[0] ?? null) : itemJoin
    return {
      ...row,
      parsedCreatedAt: new Date(row.created_at).getTime(),
      item,
      quantity: Math.max(0, Number(row.quantity ?? 0) || 0),
      total: Number(row.total ?? 0) || 0,
      unit_price: Number(row.unit_price ?? 0) || 0,
    }
  })

  const groupedFinanceRows: Array<{
    sourceRows: (FinanceTransactionRow & { parsedCreatedAt: number; item: FinanceTransactionJoinItem | null; quantity: number; total: number; unit_price: number })[]
    mode: 'buy' | 'sell'
    counterparty: string | null
    payment_mode: string | null
    notes: string | null
    created_at: string
  }> = []

  for (const row of financeRows) {
    const target = groupedFinanceRows.find((group) => {
      const createdDiff = Math.abs(new Date(group.created_at).getTime() - row.parsedCreatedAt)
      return (
        group.mode === row.mode &&
        (group.counterparty || '') === (row.counterparty || '') &&
        (group.payment_mode || '') === (row.payment_mode || '') &&
        (group.notes || '') === (row.notes || '') &&
        createdDiff <= 5000
      )
    })

    if (target) {
      target.sourceRows.push(row)
      if (row.parsedCreatedAt > new Date(target.created_at).getTime()) target.created_at = row.created_at
      continue
    }

    groupedFinanceRows.push({
      sourceRows: [row],
      mode: row.mode,
      counterparty: row.counterparty,
      payment_mode: row.payment_mode,
      notes: row.notes,
      created_at: row.created_at,
    })
  }

  for (const group of groupedFinanceRows) {
    const first = group.sourceRows[0]
    const isMulti = group.sourceRows.length > 1
    const itemLabel = isMulti ? 'Multiple' : (first.item?.name || 'Item')
    const amount = group.sourceRows.reduce((sum, row) => sum + Math.max(0, row.total), 0)
    const quantity = group.sourceRows.reduce((sum, row) => sum + Math.max(0, row.quantity), 0)
    const groupedId = isMulti ? `group:${group.sourceRows.map((row) => row.id).join(',')}` : first.id

    entries.push({
      id: groupedId,
      source: 'finance_transactions',
      movement_type: group.mode === 'buy'
        ? ((group.payment_mode === 'stock_in' || isStockInNote(group.notes)) ? 'stock_in' : 'purchase')
        : group.payment_mode === 'stock_out'
          ? 'stock_out'
          : 'sale',
      category: (first.item?.category as FinanceCategory) || 'other',
      item_label: itemLabel,
      item_image_url: isMulti ? null : (first.item?.image_url || null),
      is_multi: isMulti,
      member_name: group.counterparty,
      quantity,
      amount,
      expense_status: null,
      payment_mode: group.payment_mode,
      notes: stripStockFlowMarker(group.notes),
      created_at: group.created_at,
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
