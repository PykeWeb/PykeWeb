import { supabase } from '@/lib/supabaseClient'
import type { DbObject } from '@/lib/objectsApi'

export type TxType = 'purchase' | 'sale'

export type DbTransaction = {
  id: string
  type: TxType
  counterparty: string | null
  total: number | null
  notes: string | null
  created_at: string
}

export type DbTransactionItem = {
  id: string
  transaction_id: string
  object_id: string
  name_snapshot: string
  unit_price_snapshot: number | null
  quantity: number
  line_total: number | null
}

export type TxLineInput = {
  object: Pick<DbObject, 'id' | 'name' | 'price' | 'stock' | 'image_url'>
  quantity: number
  unit_price?: number | null
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

async function getStocks(ids: string[]) {
  const { data, error } = await supabase.from('objects').select('id, stock').in('id', ids)
  if (error) throw error
  const map = new Map<string, number>()
  for (const row of data ?? []) map.set(row.id, row.stock ?? 0)
  return map
}

async function setStock(id: string, stock: number) {
  const { error } = await supabase.from('objects').update({ stock }).eq('id', id)
  if (error) throw error
}

/**
 * MVP: create transaction + items + update stocks (non-atomic).
 * Next step: wrap into a Postgres RPC for full atomicity.
 */
export async function createTransaction(params: {
  type: TxType
  counterparty?: string | null
  notes?: string | null
  lines: TxLineInput[]
  totalOverride?: number | null
}) {
  const type = params.type
  const lines = params.lines.filter((l) => l.quantity > 0)

  if (!lines.length) {
    throw new Error('Ajoute au moins un objet.')
  }

  // Calculate totals (internal)
  const computedItems = lines.map((l) => {
    const unit = l.unit_price ?? l.object.price ?? 0
    const lineTotal = round2(unit * l.quantity)
    return {
      object_id: l.object.id,
      name_snapshot: l.object.name,
      unit_price_snapshot: unit,
      quantity: l.quantity,
      line_total: lineTotal,
    }
  })

  const computedTotal = round2(computedItems.reduce((a, b) => a + (b.line_total ?? 0), 0))
  const txTotal = params.totalOverride ?? computedTotal

  // 1) insert transaction
  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .insert({
      type,
      counterparty: params.counterparty ?? null,
      total: txTotal,
      notes: params.notes ?? null,
    })
    .select('*')
    .single()

  if (txErr) throw txErr

  // 2) insert items
  const { error: itemsErr } = await supabase.from('transaction_items').insert(
    computedItems.map((it) => ({
      transaction_id: tx.id,
      ...it,
    }))
  )
  if (itemsErr) throw itemsErr

  // 3) update stocks
  const ids = lines.map((l) => l.object.id)
  const stockMap = await getStocks(ids)

  for (const l of lines) {
    const current = stockMap.get(l.object.id) ?? l.object.stock ?? 0
    const delta = type === 'purchase' ? l.quantity : -l.quantity
    const next = current + delta
    if (next < 0) {
      throw new Error(`Stock insuffisant pour "${l.object.name}" (stock: ${current}, demandé: ${l.quantity}).`)
    }
    await setStock(l.object.id, next)
  }

  // 4) movements log (optional but useful)
  const { error: mvErr } = await supabase.from('stock_movements').insert(
    computedItems.map((it) => ({
      transaction_id: tx.id,
      object_id: it.object_id,
      delta: type === 'purchase' ? it.quantity : -it.quantity,
      unit_price_snapshot: it.unit_price_snapshot,
    }))
  )
  if (mvErr) throw mvErr

  return { transaction: tx as DbTransaction, total: txTotal, computedTotal }
}

export async function listTransactions(limit = 50) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as DbTransaction[]
}

export async function getTransaction(id: string) {
  const { data: tx, error: txErr } = await supabase.from('transactions').select('*').eq('id', id).single()
  if (txErr) throw txErr
  const { data: items, error: itErr } = await supabase
    .from('transaction_items')
    .select('*')
    .eq('transaction_id', id)
    .order('created_at', { ascending: true })
  if (itErr) throw itErr
  return { transaction: tx as DbTransaction, items: (items ?? []) as DbTransactionItem[] }
}
