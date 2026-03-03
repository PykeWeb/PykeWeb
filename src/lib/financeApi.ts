import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'

export type FinanceMovementType = 'expense' | 'purchase' | 'sale'
export type FinanceCategory = 'objects' | 'weapons' | 'equipment' | 'drugs' | 'other'

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
  created_at: string
}

export async function listFinanceEntries(): Promise<FinanceEntry[]> {
  const groupId = currentGroupId()

  const [expensesRes, txRes, tradeRes, weaponMvRes, equipmentMvRes, drugMvRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('id,item_source,item_label,member_name,quantity,total,status,created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('transactions')
      .select('id,type,counterparty,total,created_at,transaction_items(name_snapshot,quantity)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('finance_trades')
      .select('id,mode,category,item_name,quantity,unit_price,total,created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('weapon_stock_movements')
      .select('id,delta,note,created_at,weapons(name)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('equipment_stock_movements')
      .select('id,delta,note,created_at,equipment(name)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('drug_stock_movements')
      .select('id,delta,note,created_at,drug_items(name)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(300),
  ])

  if (expensesRes.error) throw expensesRes.error
  if (txRes.error) throw txRes.error
  if (tradeRes.error) throw tradeRes.error

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
      created_at: tx.created_at,
    })
  }

  for (const trade of tradeRes.data ?? []) {
    entries.push({
      id: trade.id,
      source: 'finance_trades',
      movement_type: trade.mode === 'buy' ? 'purchase' : 'sale',
      category: (trade.category as FinanceCategory) || 'other',
      item_label: trade.item_name,
      member_name: null,
      quantity: Number(trade.quantity ?? 0),
      amount: Number(trade.total ?? 0),
      expense_status: null,
      created_at: trade.created_at,
    })
  }

  const mapMovement = (rows: any[] | null, category: FinanceCategory, source: string, namePath: string) => {
    for (const row of rows ?? []) {
      const holder = row[namePath]
      const name = Array.isArray(holder) ? holder[0]?.name : holder?.name
      entries.push({
        id: row.id,
        source,
        movement_type: Number(row.delta ?? 0) >= 0 ? 'purchase' : 'sale',
        category,
        item_label: name || row.note || 'Mouvement stock',
        member_name: null,
        quantity: Math.abs(Number(row.delta ?? 0)),
        amount: null,
        expense_status: null,
        created_at: row.created_at,
      })
    }
  }

  if (!weaponMvRes.error) mapMovement(weaponMvRes.data as any[], 'weapons', 'weapon_stock_movements', 'weapons')
  if (!equipmentMvRes.error) mapMovement(equipmentMvRes.data as any[], 'equipment', 'equipment_stock_movements', 'equipment')
  if (!drugMvRes.error) mapMovement(drugMvRes.data as any[], 'drugs', 'drug_stock_movements', 'drug_items')

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
