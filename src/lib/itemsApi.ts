import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'
import type { CatalogItem, FinancePaymentMode, FinanceTransaction, ItemCategory, ItemRarity, ItemType } from '@/lib/types/itemsFinance'

const BUCKET = 'object-images'

function getExt(file: File) {
  const byName = file.name.split('.').pop()?.toLowerCase()
  if (byName && byName.length <= 5) return byName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/webp') return 'webp'
  return 'png'
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function mapCatalogItem(row: any): CatalogItem {
  return {
    ...row,
    buy_price: Number(row.buy_price ?? 0),
    sell_price: Number(row.sell_price ?? 0),
    internal_value: Number(row.internal_value ?? 0),
    stock: Number(row.stock ?? 0),
    low_stock_threshold: Number(row.low_stock_threshold ?? 0),
    max_stack: Number(row.max_stack ?? 1),
    weight: row.weight == null ? null : Number(row.weight),
  }
}

export async function listCatalogItems(): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('group_id', currentGroupId())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapCatalogItem)
}

export async function makeUniqueInternalId(name: string, current?: string) {
  const base = slugify(name) || 'item'
  let candidate = current?.trim() || base
  let i = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('catalog_items')
      .select('id')
      .eq('group_id', currentGroupId())
      .eq('internal_id', candidate)
      .limit(1)
    if (error) throw error
    if (!data || data.length === 0) return candidate
    candidate = `${base}-${i++}`
  }
}

export async function createCatalogItem(args: {
  name: string
  category: ItemCategory
  item_type: ItemType
  internal_id?: string
  description?: string
  imageFile?: File | null
  buy_price: number
  sell_price: number
  internal_value: number
  show_in_finance: boolean
  is_active: boolean
  stock: number
  low_stock_threshold: number
  stackable: boolean
  max_stack: number
  weight?: number | null
  fivem_item_id?: string
  hash?: string
  rarity?: ItemRarity
}) {
  const group_id = currentGroupId()
  const internal_id = await makeUniqueInternalId(args.name, args.internal_id)

  const { data: inserted, error: insErr } = await supabase
    .from('catalog_items')
    .insert({
      group_id,
      internal_id,
      name: args.name,
      category: args.category,
      item_type: args.item_type,
      description: args.description || null,
      buy_price: Math.max(0, Number(args.buy_price || 0)),
      sell_price: Math.max(0, Number(args.sell_price || 0)),
      internal_value: Math.max(0, Number(args.internal_value || 0)),
      show_in_finance: args.show_in_finance,
      is_active: args.is_active,
      stock: Math.max(0, Math.floor(Number(args.stock || 0))),
      low_stock_threshold: Math.max(0, Math.floor(Number(args.low_stock_threshold || 0))),
      stackable: args.stackable,
      max_stack: Math.max(1, Math.floor(Number(args.max_stack || 1))),
      weight: args.weight == null ? null : Math.max(0, Number(args.weight || 0)),
      fivem_item_id: args.fivem_item_id || null,
      hash: args.hash || null,
      rarity: args.rarity || null,
    })
    .select('*')
    .single()
  if (insErr) throw insErr

  if (args.imageFile && inserted?.id) {
    const ext = getExt(args.imageFile)
    const path = `catalog/${inserted.id}.${ext}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, args.imageFile, { upsert: true, contentType: args.imageFile.type || undefined })
    if (uploadError) throw uploadError
    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const { error: updErr } = await supabase.from('catalog_items').update({ image_url: publicData.publicUrl }).eq('id', inserted.id)
    if (updErr) throw updErr
    inserted.image_url = publicData.publicUrl
  }

  return mapCatalogItem(inserted)
}

export async function createFinanceTransaction(args: {
  item_id: string
  mode: 'buy' | 'sell'
  quantity: number
  unit_price: number
  counterparty?: string
  notes?: string
  payment_mode: FinancePaymentMode
}) {
  const qty = Math.max(1, Math.floor(Number(args.quantity || 1)))
  const unit = Math.max(0, Number(args.unit_price || 0))

  const { data: item, error: itemErr } = await supabase
    .from('catalog_items')
    .select('id,name,stock')
    .eq('group_id', currentGroupId())
    .eq('id', args.item_id)
    .single()
  if (itemErr) throw itemErr
  const currentStock = Number(item.stock ?? 0)
  const nextStock = args.mode === 'buy' ? currentStock + qty : currentStock - qty
  if (nextStock < 0) throw new Error('Stock insuffisant pour cette vente/sortie.')

  const { error: stockErr } = await supabase
    .from('catalog_items')
    .update({ stock: nextStock })
    .eq('group_id', currentGroupId())
    .eq('id', args.item_id)
  if (stockErr) throw stockErr

  const { data, error } = await supabase
    .from('finance_transactions')
    .insert({
      group_id: currentGroupId(),
      item_id: args.item_id,
      mode: args.mode,
      quantity: qty,
      unit_price: unit,
      total: qty * unit,
      counterparty: args.counterparty || null,
      notes: args.notes || null,
      payment_mode: args.payment_mode,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as FinanceTransaction
}
