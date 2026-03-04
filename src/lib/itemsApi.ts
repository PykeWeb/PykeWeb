import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'
import { toNonNegative, toPositiveInt, calcTotal } from '@/lib/numberUtils'
import { copy } from '@/lib/copy'
import type { CatalogItem, FinancePaymentMode, FinanceTransaction, ItemCategory, ItemRarity, ItemType } from '@/lib/types/itemsFinance'

const BUCKET = 'object-images'

type CatalogItemRow = Omit<CatalogItem, 'buy_price' | 'sell_price' | 'internal_value' | 'stock' | 'low_stock_threshold' | 'max_stack' | 'weight'> & {
  buy_price: number | string | null
  sell_price: number | string | null
  internal_value: number | string | null
  stock: number | string | null
  low_stock_threshold: number | string | null
  max_stack: number | string | null
  weight: number | string | null
}

export type CreateCatalogItemInput = {
  name: string
  category: ItemCategory
  item_type: ItemType
  internal_id?: string
  description?: string | null
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
  fivem_item_id?: string | null
  hash?: string | null
  rarity?: ItemRarity
}

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

function mapCatalogItem(row: CatalogItemRow): CatalogItem {
  return {
    ...row,
    buy_price: toNonNegative(row.buy_price),
    sell_price: toNonNegative(row.sell_price),
    internal_value: toNonNegative(row.internal_value),
    stock: toNonNegative(row.stock),
    low_stock_threshold: toNonNegative(row.low_stock_threshold),
    max_stack: toPositiveInt(row.max_stack, 1),
    weight: row.weight == null ? null : toNonNegative(row.weight),
  }
}

export async function listCatalogItems(): Promise<CatalogItem[]> {
  const { data, error } = await supabase.from('catalog_items').select('*').eq('group_id', currentGroupId()).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => mapCatalogItem(row as CatalogItemRow))
}

export async function makeUniqueInternalId(name: string, current?: string) {
  const base = slugify(name) || 'item'
  let candidate = current?.trim() || base
  let i = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.from('catalog_items').select('id').eq('group_id', currentGroupId()).eq('internal_id', candidate).limit(1)
    if (error) throw error
    if (!data || data.length === 0) return candidate
    candidate = `${base}-${i++}`
  }
}

export async function createCatalogItem(args: CreateCatalogItemInput) {
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
      buy_price: toNonNegative(args.buy_price),
      sell_price: toNonNegative(args.sell_price),
      internal_value: toNonNegative(args.internal_value),
      show_in_finance: args.show_in_finance,
      is_active: args.is_active,
      stock: toNonNegative(args.stock),
      low_stock_threshold: toNonNegative(args.low_stock_threshold),
      stackable: args.stackable,
      max_stack: toPositiveInt(args.max_stack),
      weight: args.weight == null ? null : toNonNegative(args.weight),
      fivem_item_id: args.fivem_item_id || null,
      hash: args.hash || null,
      rarity: args.rarity || null,
    })
    .select('*')
    .single<CatalogItemRow>()
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
  const qty = toPositiveInt(args.quantity)
  const unit = toNonNegative(args.unit_price)

  const { data: item, error: itemErr } = await supabase
    .from('catalog_items')
    .select('id,name,stock')
    .eq('group_id', currentGroupId())
    .eq('id', args.item_id)
    .single<{ id: string; name: string; stock: number | null }>()

  if (itemErr) throw itemErr

  const currentStock = toNonNegative(item.stock)
  const nextStock = args.mode === 'buy' ? currentStock + qty : currentStock - qty
  if (nextStock < 0) throw new Error(copy.finance.errors.stockInsufficient)

  const { error: stockErr } = await supabase.from('catalog_items').update({ stock: nextStock }).eq('group_id', currentGroupId()).eq('id', args.item_id)
  if (stockErr) throw stockErr

  const { data, error } = await supabase
    .from('finance_transactions')
    .insert({
      group_id: currentGroupId(),
      item_id: args.item_id,
      mode: args.mode,
      quantity: qty,
      unit_price: unit,
      total: calcTotal(qty, unit),
      counterparty: args.counterparty || null,
      notes: args.notes || null,
      payment_mode: args.payment_mode,
    })
    .select('*')
    .single<FinanceTransaction>()

  if (error) throw error
  return data
}
