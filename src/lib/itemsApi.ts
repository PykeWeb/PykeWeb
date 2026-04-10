import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'
import { getTenantSession } from '@/lib/tenantSession'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import { toNonNegative, toPositiveInt, calcTotal } from '@/lib/numberUtils'
import { copy } from '@/lib/copy'
import { createAppLog } from '@/lib/logsApi'
import { getSuggestedInternalId } from '@/lib/itemId'
import type { CatalogItem, FinancePaymentMode, FinanceTransaction, ItemCategory, ItemRarity, ItemType } from '@/lib/types/itemsFinance'
import { normalizeCatalogCategory, normalizeItemType } from '@/lib/catalogConfig'

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

type GlobalCatalogApiRow = {
  id: string
  global_item_id?: string
  internal_id?: string | null
  category: string
  name: string
  price: number | null
  default_quantity: number | null
  description: string | null
  image_url: string | null
  item_type: string | null
  weapon_id: string | null
  created_at: string
}

async function fetchGlobalCatalogItems(): Promise<GlobalCatalogRow[]> {
  const response = await fetch('/api/catalog/items', withTenantSessionHeader({ cache: 'no-store' }))
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'global catalog unavailable')
  }
  const rows = (await response.json()) as GlobalCatalogApiRow[]
  return rows
    .map((row) => {
      const category = normalizeCatalogCategory(row.category) || 'objects'
      return {
        id: row.global_item_id || row.id.replace(/^global:/, ''),
        internal_id: row.internal_id ?? null,
        category,
        item_type: normalizeItemType(row.item_type, category) as ItemType | null,
        name: row.name,
        description: row.description,
        image_url: row.image_url,
        price: row.price,
        default_quantity: row.default_quantity,
        weapon_id: row.weapon_id,
        created_at: row.created_at,
      }
    })
    .filter((row) => Boolean(row)) as GlobalCatalogRow[]
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

function mapCatalogItem(row: CatalogItemRow): CatalogItem {
  const category = normalizeCatalogCategory(String(row.category || '')) || 'objects'
  return {
    ...row,
    category,
    item_type: normalizeItemType(row.item_type, category),
    buy_price: toNonNegative(row.buy_price),
    sell_price: toNonNegative(row.sell_price),
    internal_value: toNonNegative(row.internal_value),
    stock: toNonNegative(row.stock),
    low_stock_threshold: toNonNegative(row.low_stock_threshold),
    max_stack: toPositiveInt(row.max_stack, 1),
    weight: row.weight == null ? null : toNonNegative(row.weight),
  }
}

export async function listCatalogItems(includeInactive = false): Promise<CatalogItem[]> {
  let query = supabase.from('catalog_items').select('*').eq('group_id', currentGroupId())
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => mapCatalogItem(row as CatalogItemRow))
}

export type CatalogItemStockLite = {
  id: string
  name: string
  category: ItemCategory
  item_type: ItemType
  stock: number
}

export async function listCatalogItemsStockLite(includeInactive = false): Promise<CatalogItemStockLite[]> {
  let query = supabase
    .from('catalog_items')
    .select('id,name,category,item_type,stock,is_active')
    .eq('group_id', currentGroupId())
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => {
    const category = normalizeCatalogCategory(String(row.category || '')) || 'objects'
    return {
      id: String(row.id),
      name: String(row.name || ''),
      category,
      item_type: normalizeItemType(row.item_type, category),
      stock: toNonNegative(row.stock),
    }
  })
}




type GlobalCatalogRow = {
  id: string
  internal_id?: string | null
  category: ItemCategory
  item_type: ItemType | null
  name: string
  description: string | null
  image_url: string | null
  price: number | null
  default_quantity: number | null
  weapon_id: string | null
  created_at: string
}

type GlobalCatalogOverrideRow = {
  global_item_id: string
  is_hidden: boolean | null
  override_name: string | null
  override_price: number | null
  override_description: string | null
  override_image_url: string | null
  override_item_type: string | null
  override_weapon_id: string | null
}

type LegacyObjectRow = {
  id: string
  name: string
  price: number | null
  description: string | null
  image_url: string | null
  stock: number | null
  created_at: string
}

type LegacyWeaponRow = {
  id: string
  name: string | null
  weapon_id: string | null
  description: string | null
  image_url: string | null
  stock: number | null
  created_at: string
}

type LegacyEquipmentRow = {
  id: string
  name: string
  price: number | null
  description: string | null
  image_url: string | null
  stock: number | null
  created_at: string
}

type LegacyDrugRow = {
  id: string
  type: string | null
  name: string
  price: number | null
  description: string | null
  image_url: string | null
  stock: number | null
  created_at: string
}

function normalizeLegacyDrugType(raw: string | null): ItemType {
  const value = (raw || '').toLowerCase().trim()
  if (value === 'seed') return 'seed'
  if (value === 'pouch') return 'pouch'
  if (value === 'drug' || value === 'product' || value === 'production' || value === 'output' || value === 'equipment') return 'product'
  if (value === 'planting' || value === 'recipe' || value === 'material' || value === 'drug_material') return 'drug_material'
  return 'drug_material'
}


function mapLegacyItem(args: {
  id: string
  name: string
  category: ItemCategory
  item_type: ItemType
  description: string | null
  image_url: string | null
  stock: number | null
  buy_price: number | null
  sell_price: number | null
  created_at: string
}): CatalogItem {
  const internalId = getSuggestedInternalId(args.name)
  const price = toNonNegative(args.buy_price)
  return {
    id: `legacy:${args.category}:${args.id}`,
    group_id: currentGroupId(),
    internal_id: internalId,
    name: args.name,
    category: args.category,
    item_type: normalizeItemType(args.item_type, args.category),
    description: args.description,
    image_url: args.image_url,
    buy_price: price,
    sell_price: toNonNegative(args.sell_price ?? price),
    internal_value: 0,
    show_in_finance: true,
    is_active: true,
    stock: toNonNegative(args.stock),
    low_stock_threshold: 0,
    stackable: true,
    max_stack: 100,
    weight: null,
    fivem_item_id: null,
    hash: null,
    rarity: null,
    created_at: args.created_at,
    updated_at: args.created_at,
  }
}

function getCatalogMergeKey(input: { name: string; internal_id?: string | null }) {
  const internal = String(input.internal_id ?? '').trim().toLowerCase()
  if (internal) return `internal:${internal}`
  return `name:${input.name.trim().toLowerCase()}`
}

function getCatalogNameKey(name: string) {
  return `name:${name.trim().toLowerCase()}`
}

export async function listCatalogItemsUnified(includeInactive = false): Promise<CatalogItem[]> {
  const groupId = currentGroupId()
  const catalogQuery = supabase.from('catalog_items').select('*').eq('group_id', groupId)
  if (!includeInactive) catalogQuery.eq('is_active', true)

  const [catalogRes, hiddenRes, objectsRes, weaponsRes, equipmentRes, drugsRes, globalRes, overridesRes] = await Promise.all([
    catalogQuery.order('created_at', { ascending: false }),
    supabase.from('catalog_items').select('name,category').eq('group_id', groupId).eq('is_active', false),
    supabase.from('objects').select('id,name,price,description,image_url,stock,created_at').eq('group_id', groupId),
    supabase.from('weapons').select('id,name,weapon_id,description,image_url,stock,created_at').eq('group_id', groupId),
    supabase.from('equipment').select('id,name,price,description,image_url,stock,created_at').eq('group_id', groupId),
    supabase.from('drug_items').select('id,type,name,price,description,image_url,stock,created_at').eq('group_id', groupId),
    groupId === 'admin'
      ? Promise.resolve({ data: [], error: null } as { data: GlobalCatalogRow[]; error: null })
      : fetchGlobalCatalogItems()
          .then((data) => ({ data, error: null as null }))
          .catch((error: unknown) => ({ data: [] as GlobalCatalogRow[], error: error instanceof Error ? error : new Error('global catalog unavailable') })),
    groupId === 'admin'
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from('catalog_items_group_overrides')
          .select('global_item_id,is_hidden,override_name,override_price,override_description,override_image_url,override_item_type,override_weapon_id')
          .eq('group_id', groupId),
  ])

  if (catalogRes.error) throw catalogRes.error
  if (hiddenRes.error) throw hiddenRes.error
  if (objectsRes.error) throw objectsRes.error
  if (weaponsRes.error) throw weaponsRes.error
  if (equipmentRes.error) throw equipmentRes.error
  if (drugsRes.error) throw drugsRes.error
  if (globalRes.error) throw globalRes.error
  if (overridesRes.error) throw overridesRes.error

  const catalogItems = (catalogRes.data ?? []).map((row) => mapCatalogItem(row as CatalogItemRow))
  const byName = new Set<string>()
  for (const item of catalogItems) {
    byName.add(getCatalogMergeKey(item))
    byName.add(getCatalogNameKey(item.name))
  }
  const hiddenNames = new Set(((hiddenRes.data ?? []) as { name: string; category: ItemCategory }[]).map((x) => getCatalogNameKey(x.name)))

  const legacyObjects = (objectsRes.data ?? []).map((row) => {
    const r = row as LegacyObjectRow
    return mapLegacyItem({
      id: r.id,
      name: r.name,
      category: 'objects',
      item_type: 'consumable',
      description: r.description,
      image_url: r.image_url,
      stock: r.stock,
      buy_price: r.price,
      sell_price: r.price,
      created_at: r.created_at,
    })
  })

  const legacyWeapons = (weaponsRes.data ?? []).map((row) => {
    const r = row as LegacyWeaponRow
    const fallbackName = r.name?.trim() || r.weapon_id?.trim() || 'Arme'
    return mapLegacyItem({
      id: r.id,
      name: fallbackName,
      category: 'weapons',
      item_type: 'weapon',
      description: r.description,
      image_url: r.image_url,
      stock: r.stock,
      buy_price: 0,
      sell_price: 0,
      created_at: r.created_at,
    })
  })

  const legacyEquipment = (equipmentRes.data ?? []).map((row) => {
    const r = row as LegacyEquipmentRow
    return mapLegacyItem({
      id: r.id,
      name: r.name,
      category: 'equipment',
      item_type: 'equipment',
      description: r.description,
      image_url: r.image_url,
      stock: r.stock,
      buy_price: r.price,
      sell_price: r.price,
      created_at: r.created_at,
    })
  })

  const legacyDrugs = (drugsRes.data ?? []).map((row) => {
    const r = row as LegacyDrugRow
    return mapLegacyItem({
      id: r.id,
      name: r.name,
      category: 'drugs',
      item_type: normalizeLegacyDrugType(r.type),
      description: r.description,
      image_url: r.image_url,
      stock: r.stock,
      buy_price: r.price,
      sell_price: r.price,
      created_at: r.created_at,
    })
  })

  const mergedLegacy = [...legacyObjects, ...legacyWeapons, ...legacyEquipment, ...legacyDrugs].filter((item) => {
    const key = getCatalogMergeKey(item)
    const nameKey = getCatalogNameKey(item.name)
    return !byName.has(key) && !byName.has(nameKey) && !hiddenNames.has(nameKey)
  })

  const overrideMap = new Map(((overridesRes.data ?? []) as GlobalCatalogOverrideRow[]).map((row) => [row.global_item_id, row]))
  const globalItems = ((globalRes.data ?? []) as GlobalCatalogRow[])
    .map((row) => {
      const override = overrideMap.get(row.id)
      if (override?.is_hidden) return null
      const category = row.category as ItemCategory
      const name = (override?.override_name || row.name || '').trim()
      if (!name) return null
      const key = getCatalogMergeKey({ name, internal_id: row.internal_id || null })
      const nameKey = getCatalogNameKey(name)
      if (byName.has(key) || byName.has(nameKey) || hiddenNames.has(nameKey)) return null
      const buyPrice = toNonNegative(override?.override_price ?? row.price ?? 0)
      const itemTypeRaw = (override?.override_item_type || row.item_type || 'other') as ItemType
      const itemType = normalizeItemType(itemTypeRaw, category)
      return {
        id: `global:${row.id}`,
        group_id: groupId,
        internal_id: (row.internal_id || '').trim() || `global-${row.id}`,
        name,
        category,
        item_type: itemType,
        description: override?.override_description ?? row.description,
        image_url: override?.override_image_url ?? row.image_url,
        buy_price: buyPrice,
        sell_price: buyPrice,
        internal_value: 0,
        show_in_finance: true,
        is_active: true,
        stock: toNonNegative(row.default_quantity ?? 0),
        low_stock_threshold: 0,
        stackable: true,
        max_stack: 100,
        weight: null,
        fivem_item_id: override?.override_weapon_id ?? row.weapon_id,
        hash: null,
        rarity: null,
        created_at: row.created_at,
        updated_at: row.created_at,
      } as CatalogItem
    })
    .filter((item): item is CatalogItem => Boolean(item))

  const allItems = [
    ...catalogItems,
    ...mergedLegacy,
    ...globalItems,
  ]

  const mergedByKey = new Map<string, CatalogItem>()
  for (const item of allItems) {
    const key = getCatalogMergeKey(item)
    const existing = mergedByKey.get(key)
    if (!existing) {
      mergedByKey.set(key, item)
      continue
    }

    const existingIsLocal = !existing.id.startsWith('global:') && !existing.id.startsWith('admin:')
    const currentIsLocal = !item.id.startsWith('global:') && !item.id.startsWith('admin:')

    if (!existingIsLocal && currentIsLocal) {
      mergedByKey.set(key, item)
      continue
    }

    if (existingIsLocal === currentIsLocal) {
      const existingDate = new Date(existing.created_at).getTime()
      const currentDate = new Date(item.created_at).getTime()
      if (Number.isFinite(currentDate) && (!Number.isFinite(existingDate) || currentDate > existingDate)) {
        mergedByKey.set(key, item)
      }
    }
  }

  return [...mergedByKey.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))
}
export async function makeUniqueInternalId(name: string, current?: string) {
  const base = getSuggestedInternalId(name)
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

async function insertLegacyItem(args: CreateCatalogItemInput): Promise<CatalogItem> {
  const groupId = currentGroupId()
  const safeName = args.name.trim()

  if (args.category === 'objects') {
    const { data, error } = await supabase
      .from('objects')
      .insert({ group_id: groupId, name: safeName, price: toNonNegative(args.buy_price), stock: toNonNegative(args.stock), description: args.description || null })
      .select('id,name,price,description,image_url,stock,created_at')
      .single<LegacyObjectRow>()
    if (error) throw error
    return mapLegacyItem({
      id: data.id,
      name: data.name,
      category: 'objects',
      item_type: normalizeItemType(args.item_type, args.category),
      description: data.description,
      image_url: data.image_url,
      stock: data.stock,
      buy_price: data.price,
      sell_price: toNonNegative(args.sell_price),
      created_at: data.created_at,
    })
  }

  if (args.category === 'weapons') {
    const { data, error } = await supabase
      .from('weapons')
      .insert({ group_id: groupId, name: safeName, weapon_id: args.fivem_item_id || null, stock: toNonNegative(args.stock), description: args.description || null })
      .select('id,name,weapon_id,description,image_url,stock,created_at')
      .single<LegacyWeaponRow>()
    if (error) throw error
    return mapLegacyItem({
      id: data.id,
      name: data.name || data.weapon_id || safeName,
      category: 'weapons',
      item_type: 'weapon',
      description: data.description,
      image_url: data.image_url,
      stock: data.stock,
      buy_price: toNonNegative(args.buy_price),
      sell_price: toNonNegative(args.sell_price),
      created_at: data.created_at,
    })
  }

  if (args.category === 'equipment') {
    const { data, error } = await supabase
      .from('equipment')
      .insert({ group_id: groupId, name: safeName, price: toNonNegative(args.buy_price), stock: toNonNegative(args.stock), description: args.description || null })
      .select('id,name,price,description,image_url,stock,created_at')
      .single<LegacyEquipmentRow>()
    if (error) throw error
    return mapLegacyItem({
      id: data.id,
      name: data.name,
      category: 'equipment',
      item_type: 'equipment',
      description: data.description,
      image_url: data.image_url,
      stock: data.stock,
      buy_price: data.price,
      sell_price: toNonNegative(args.sell_price),
      created_at: data.created_at,
    })
  }

  if (args.category === 'drugs') {
    const { data, error } = await supabase
      .from('drug_items')
      .insert({ group_id: groupId, type: args.item_type === 'pouch' ? 'pouch' : args.item_type === 'seed' ? 'seed' : 'drug', name: safeName, price: toNonNegative(args.buy_price), stock: toNonNegative(args.stock), description: args.description || null })
      .select('id,type,name,price,description,image_url,stock,created_at')
      .single<LegacyDrugRow>()
    if (error) throw error
    return mapLegacyItem({
      id: data.id,
      name: data.name,
      category: 'drugs',
      item_type: normalizeLegacyDrugType(data.type),
      description: data.description,
      image_url: data.image_url,
      stock: data.stock,
      buy_price: data.price,
      sell_price: toNonNegative(args.sell_price),
      created_at: data.created_at,
    })
  }

  throw new Error('Catégorie non supportée pour fallback legacy.')
}

function parseLegacyInternalId(internalId: string | undefined | null): { category: ItemCategory; sourceId: string } | null {
  if (!internalId) return null
  const match = internalId.match(/^legacy-(objects|weapons|equipment|drugs)-(.+)$/)
  if (!match) return null
  return { category: match[1] as ItemCategory, sourceId: match[2] }
}

async function upsertLegacyMirror(args: { category: ItemCategory; name: string; description?: string | null; buy_price: number; stock: number; item_type: ItemType; lookupName?: string }) {
  const groupId = currentGroupId()
  const safeName = args.name.trim()
  const lookupName = args.lookupName?.trim() || safeName

  if (args.category === 'objects') {
    const { data: existing } = await supabase.from('objects').select('id').eq('group_id', groupId).eq('name', lookupName).maybeSingle<{ id: string }>()
    if (existing?.id) {
      await supabase.from('objects').update({ name: safeName, price: toNonNegative(args.buy_price), stock: toNonNegative(args.stock), description: args.description || null }).eq('group_id', groupId).eq('id', existing.id)
      return
    }
    await supabase.from('objects').insert({ group_id: groupId, name: safeName, price: toNonNegative(args.buy_price), stock: toNonNegative(args.stock), description: args.description || null })
    return
  }

  if (args.category === 'equipment') {
    const { data: existing } = await supabase.from('equipment').select('id').eq('group_id', groupId).eq('name', lookupName).maybeSingle<{ id: string }>()
    if (existing?.id) {
      await supabase.from('equipment').update({ name: safeName, price: toNonNegative(args.buy_price), stock: toNonNegative(args.stock), description: args.description || null }).eq('group_id', groupId).eq('id', existing.id)
      return
    }
    await supabase.from('equipment').insert({ group_id: groupId, name: safeName, price: toNonNegative(args.buy_price), stock: toNonNegative(args.stock), description: args.description || null })
    return
  }

  if (args.category === 'weapons') {
    const { data: existing } = await supabase.from('weapons').select('id').eq('group_id', groupId).eq('name', lookupName).maybeSingle<{ id: string }>()
    if (existing?.id) {
      await supabase.from('weapons').update({ name: safeName, stock: toNonNegative(args.stock), description: args.description || null }).eq('group_id', groupId).eq('id', existing.id)
      return
    }
    await supabase.from('weapons').insert({ group_id: groupId, name: safeName, stock: toNonNegative(args.stock), description: args.description || null })
    return
  }

  if (args.category === 'drugs') {
    const drugType = args.item_type === 'pouch' ? 'pouch' : args.item_type === 'seed' ? 'seed' : 'drug'
    const { data: existing } = await supabase.from('drug_items').select('id').eq('group_id', groupId).eq('name', lookupName).maybeSingle<{ id: string }>()
    if (existing?.id) {
      await supabase.from('drug_items').update({ name: safeName, type: drugType, price: toNonNegative(args.buy_price), stock: toNonNegative(args.stock), description: args.description || null }).eq('group_id', groupId).eq('id', existing.id)
      return
    }
    await supabase.from('drug_items').insert({ group_id: groupId, name: safeName, type: drugType, price: toNonNegative(args.buy_price), stock: toNonNegative(args.stock), description: args.description || null })
  }
}

async function deleteLegacyMirror(args: { category: ItemCategory; name: string; internal_id?: string | null }): Promise<'deleted' | 'fk_blocked' | 'not_found'> {
  const groupId = currentGroupId()
  const legacy = parseLegacyInternalId(args.internal_id)

  const runDelete = async (
    table: 'objects' | 'weapons' | 'equipment' | 'drug_items',
    matcher: { byId?: string; byName?: string; byWeaponId?: string }
  ) => {
    const base = supabase.from(table).delete().eq('group_id', groupId)
    const query = matcher.byId
      ? base.eq('id', matcher.byId)
      : matcher.byWeaponId
        ? base.eq('weapon_id', matcher.byWeaponId)
        : base.eq('name', matcher.byName || args.name)

    const { data, error } = await query.select('id')
    if (!error) {
      if (!data || data.length === 0) return 'not_found' as const
      return 'deleted' as const
    }
    if (error.code === '23503') return 'fk_blocked' as const
    throw error
  }

  if (legacy?.category === args.category && legacy.category !== 'custom') {
    const table = legacy.category === 'drugs' ? 'drug_items' : legacy.category
    return runDelete(table, { byId: legacy.sourceId, byWeaponId: legacy.category === 'weapons' ? legacy.sourceId : undefined })
  }

  if (args.category === 'objects') return runDelete('objects', { byName: args.name })
  if (args.category === 'equipment') return runDelete('equipment', { byName: args.name })
  if (args.category === 'drugs') return runDelete('drug_items', { byName: args.name })
  if (args.category === 'weapons') {
    const byName = await runDelete('weapons', { byName: args.name })
    if (byName !== 'not_found') return byName
    return runDelete('weapons', { byWeaponId: args.name })
  }
  return 'not_found'
}



export type UpdateCatalogItemInput = CreateCatalogItemInput & { id: string }

export async function createCatalogItem(args: CreateCatalogItemInput) {
  const group_id = currentGroupId()
  const internal_id = await makeUniqueInternalId(args.name, args.internal_id)

  const payload = {
    group_id,
    internal_id,
    name: args.name,
    category: args.category,
    item_type: normalizeItemType(args.item_type, args.category),
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
  }

  const { data: inserted, error: insErr } = await supabase.from('catalog_items').insert(payload).select('*').single<CatalogItemRow>()

  if (insErr) {
    console.error('[items:create] catalog_items insert failed, fallback legacy', insErr)
    try {
      return await insertLegacyItem(args)
    } catch (legacyError) {
      console.error('[items:create] legacy fallback failed', legacyError)
      throw insErr
    }
  }

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

  await upsertLegacyMirror({
    category: args.category,
    name: args.name,
    description: args.description,
    buy_price: args.buy_price,
    stock: args.stock,
    item_type: args.item_type,
  })

  const isAdminSession = typeof window !== 'undefined' && Boolean(getTenantSession()?.isAdmin)
  if (group_id === 'admin' || isAdminSession) {
    const globalPayload = {
      internal_id: inserted.internal_id,
      category: args.category,
      item_type: normalizeItemType(args.item_type, args.category),
      name: args.name,
      description: args.description || null,
      image_url: inserted.image_url || null,
      price: toNonNegative(args.buy_price),
      default_quantity: toNonNegative(args.stock),
      weapon_id: args.fivem_item_id || null,
    }

    try {
      const res = await fetch('/api/admin/global-catalog', {
        ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
        method: 'POST',
        body: JSON.stringify(globalPayload),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Global sync failed')
      }
    } catch (globalApiError) {
      const { error: globalError } = await supabase.from('catalog_items_global').insert(globalPayload)
      if (globalError) {
        const fallbackPayload = { ...globalPayload } as Record<string, unknown>
        delete fallbackPayload.internal_id
        const { error: globalFallbackError } = await supabase.from('catalog_items_global').insert(fallbackPayload)
        if (globalFallbackError) {
          console.warn('[items:create] global insert skipped', globalFallbackError.message, globalApiError)
        }
      }
    }
  }

  return mapCatalogItem(inserted)
}

function toNullableString(value: string | null | undefined) {
  const normalized = String(value ?? '').trim()
  return normalized.length ? normalized : null
}

function isItemTypeConstraintError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const message = String((error as { message?: unknown }).message || '').toLowerCase()
  return message.includes('catalog_items_item_type_check') || (message.includes('item_type') && message.includes('check constraint'))
}

function withLegacyDbItemType(category: ItemCategory, itemType: ItemType): ItemType[] {
  if (category === 'objects') return [itemType, 'consumable', 'material', 'other']
  if (category === 'custom') return [itemType, 'other', 'input']
  if (category === 'weapons') return [itemType, 'weapon']
  if (category === 'equipment') return [itemType, 'equipment']
  return [itemType, 'product', 'drug_material', 'other']
}

export async function updateCatalogItem(args: UpdateCatalogItemInput) {
  try {
    const resolved = await resolveCatalogItemId(args.id)
    const groupId = currentGroupId()
    const { data: current, error: currentError } = await supabase
      .from('catalog_items')
      .select('id,name,description,category,item_type,buy_price,sell_price,stock,fivem_item_id,internal_id,image_url')
      .eq('group_id', groupId)
      .eq('id', resolved)
      .maybeSingle<{
        id: string
        name: string
        description: string | null
        category: ItemCategory
        item_type: ItemType | null
        buy_price: number | string | null
        sell_price: number | string | null
        stock: number | string | null
        fivem_item_id: string | null
        internal_id: string | null
        image_url: string | null
      }>()

    if (currentError) throw currentError
    if (!current) throw new Error('Impossible de modifier: item introuvable ou non autorisé.')

    const nextPayload = {
      name: args.name.trim(),
      category: args.category,
      item_type: normalizeItemType(args.item_type, args.category),
      description: toNullableString(args.description),
      buy_price: toNonNegative(args.buy_price),
      sell_price: toNonNegative(args.sell_price),
      stock: toNonNegative(args.stock),
      fivem_item_id: toNullableString(args.fivem_item_id),
    }

    const hasDataChange = (
      current.name !== nextPayload.name ||
      current.category !== nextPayload.category ||
      normalizeItemType(current.item_type, current.category) !== nextPayload.item_type ||
      toNullableString(current.description) !== nextPayload.description ||
      toNonNegative(current.buy_price) !== nextPayload.buy_price ||
      toNonNegative(current.sell_price) !== nextPayload.sell_price ||
      toNonNegative(current.stock) !== nextPayload.stock ||
      toNullableString(current.fivem_item_id) !== nextPayload.fivem_item_id
    )

    if (!hasDataChange && !args.imageFile) {
      throw new Error('Aucune modification détectée.')
    }

    let updateResult = await supabase
      .from('catalog_items')
      .update({
        ...nextPayload,
        updated_at: new Date().toISOString(),
      })
      .eq('group_id', groupId)
      .eq('id', resolved)
      .select('id')

    if (updateResult.error && isItemTypeConstraintError(updateResult.error)) {
      const candidates = withLegacyDbItemType(nextPayload.category, nextPayload.item_type)
      for (const candidate of candidates) {
        if (candidate === nextPayload.item_type) continue
        updateResult = await supabase
          .from('catalog_items')
          .update({
            ...nextPayload,
            item_type: candidate,
            updated_at: new Date().toISOString(),
          })
          .eq('group_id', groupId)
          .eq('id', resolved)
          .select('id')
        if (!updateResult.error) break
      }
    }

    if (updateResult.error) throw updateResult.error
    if (!updateResult.data || updateResult.data.length === 0) throw new Error('Impossible de modifier: item introuvable ou non autorisé.')

    if (args.imageFile) {
    const ext = getExt(args.imageFile)
    const path = `catalog/${resolved}.${ext}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, args.imageFile, {
      upsert: true,
      contentType: args.imageFile.type || undefined,
    })
    if (uploadError) throw uploadError

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const { error: imageUpdateError } = await supabase
      .from('catalog_items')
      .update({ image_url: publicData.publicUrl, updated_at: new Date().toISOString() })
      .eq('group_id', groupId)
      .eq('id', resolved)

    if (imageUpdateError) throw imageUpdateError
  }

    await upsertLegacyMirror({
    category: args.category,
    name: nextPayload.name,
    description: nextPayload.description,
    buy_price: args.buy_price,
    stock: args.stock,
    item_type: args.item_type,
    lookupName: current?.name,
  })

    const { data: refreshed, error: refreshError } = await supabase
    .from('catalog_items')
    .select('name,buy_price,sell_price,stock,category,item_type,fivem_item_id,description,image_url')
    .eq('group_id', groupId)
    .eq('id', resolved)
    .single<{
      name: string
      buy_price: number | string | null
      sell_price: number | string | null
      stock: number | string | null
      category: ItemCategory
      item_type: ItemType | null
      fivem_item_id: string | null
      description: string | null
      image_url: string | null
    }>()

    if (refreshError) throw refreshError

    const updateApplied = (
    refreshed.name === nextPayload.name &&
    refreshed.category === nextPayload.category &&
    normalizeItemType(refreshed.item_type, refreshed.category) === nextPayload.item_type &&
    toNullableString(refreshed.description) === nextPayload.description &&
    toNonNegative(refreshed.buy_price) === nextPayload.buy_price &&
    toNonNegative(refreshed.sell_price) === nextPayload.sell_price &&
    toNonNegative(refreshed.stock) === nextPayload.stock &&
    toNullableString(refreshed.fivem_item_id) === nextPayload.fivem_item_id
  )

    if (!updateApplied) {
      throw new Error("La mise à jour n'a pas été appliquée correctement.")
    }

    if (groupId === 'admin') {
    const globalPayload = {
      category: refreshed.category,
      item_type: normalizeItemType(refreshed.item_type, refreshed.category),
      name: refreshed.name,
      description: toNullableString(refreshed.description),
      image_url: toNullableString(refreshed.image_url),
      price: toNonNegative(refreshed.buy_price),
      default_quantity: toNonNegative(refreshed.stock),
      weapon_id: toNullableString(refreshed.fivem_item_id),
      updated_at: new Date().toISOString(),
    }

    const { data: existingGlobal, error: globalLookupError } = await supabase
      .from('catalog_items_global')
      .select('id')
      .eq('internal_id', current.internal_id || '')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>()

    if (globalLookupError) throw new Error(`catalog_items_global lookup: ${globalLookupError.message}`)

    let globalRowId = existingGlobal?.id ?? null
    if (!globalRowId) {
      const { data: byNameGlobal, error: byNameLookupError } = await supabase
        .from('catalog_items_global')
        .select('id')
        .eq('name', current.name)
        .eq('category', current.category)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>()
      if (byNameLookupError) throw new Error(`catalog_items_global fallback lookup: ${byNameLookupError.message}`)
      globalRowId = byNameGlobal?.id ?? null
    }

    if (globalRowId) {
      const { error: globalUpdateError } = await supabase
        .from('catalog_items_global')
        .update(globalPayload)
        .eq('id', globalRowId)
      if (globalUpdateError) throw new Error(`catalog_items_global update: ${globalUpdateError.message}`)
    } else {
      const { error: globalInsertError } = await supabase.from('catalog_items_global').insert(globalPayload)
      if (globalInsertError) throw new Error(`catalog_items_global insert: ${globalInsertError.message}`)
    }

    const candidates: Array<{
      id: string
      name: string
      description: string | null
      category: ItemCategory
      item_type: ItemType | null
      buy_price: number | string | null
      sell_price: number | string | null
      stock: number | string | null
      fivem_item_id: string | null
      internal_id: string | null
      image_url: string | null
    }> = []

    if (current.internal_id) {
      const { data, error: candidateError } = await supabase
        .from('catalog_items')
        .select('id,name,description,category,item_type,buy_price,sell_price,stock,fivem_item_id,internal_id,image_url')
        .neq('group_id', 'admin')
        .eq('internal_id', current.internal_id)
        .eq('is_active', true)
      if (candidateError) throw new Error(`catalog_items propagation lookup: ${candidateError.message}`)
      candidates.push(...((data ?? []) as typeof candidates))
    }

    const { data: byNameCandidates, error: byNameCandidateError } = await supabase
      .from('catalog_items')
      .select('id,name,description,category,item_type,buy_price,sell_price,stock,fivem_item_id,internal_id,image_url')
      .neq('group_id', 'admin')
      .eq('name', current.name)
      .eq('category', current.category)
      .eq('is_active', true)
    if (byNameCandidateError) throw new Error(`catalog_items propagation fallback lookup: ${byNameCandidateError.message}`)
    for (const row of ((byNameCandidates ?? []) as typeof candidates)) {
      if (!candidates.some((entry) => entry.id === row.id)) candidates.push(row)
    }

    for (const row of candidates) {
      const untouched =
        row.name === current.name
        && row.category === current.category
        && normalizeItemType(row.item_type, row.category) === normalizeItemType(current.item_type, current.category)
        && toNullableString(row.description) === toNullableString(current.description)
        && toNonNegative(row.buy_price) === toNonNegative(current.buy_price)
        && toNonNegative(row.sell_price) === toNonNegative(current.sell_price)
        && toNonNegative(row.stock) === toNonNegative(current.stock)
        && toNullableString(row.fivem_item_id) === toNullableString(current.fivem_item_id)
        && toNullableString(row.image_url) === toNullableString(current.image_url)

      if (!untouched) continue

      const { error: propagateError } = await supabase
        .from('catalog_items')
        .update({
          name: refreshed.name,
          category: refreshed.category,
          item_type: normalizeItemType(refreshed.item_type, refreshed.category),
          description: toNullableString(refreshed.description),
          buy_price: toNonNegative(refreshed.buy_price),
          sell_price: toNonNegative(refreshed.sell_price),
          stock: toNonNegative(refreshed.stock),
          fivem_item_id: toNullableString(refreshed.fivem_item_id),
          image_url: toNullableString(refreshed.image_url),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      if (propagateError) throw new Error(`catalog_items propagation update: ${propagateError.message}`)
    }
    }
  } catch (error: unknown) {
    if (error instanceof Error) throw error
    if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
      throw new Error((error as { message: string }).message)
    }
    throw new Error("Impossible de modifier l'item.")
  }
}

export async function deleteCatalogItem(itemId: string) {
  const resolved = await resolveCatalogItemId(itemId)
  const groupId = currentGroupId()
  const { data: current } = await supabase
    .from('catalog_items')
    .select('name,category,internal_id,is_active')
    .eq('group_id', groupId)
    .eq('id', resolved)
    .maybeSingle<{ name: string; category: ItemCategory; internal_id: string | null; is_active: boolean | null }>()

  if (!current) throw new Error('Impossible de supprimer: item introuvable.')
  if (current.is_active === false) throw new Error('Cet item est déjà supprimé pour ce groupe.')

  const legacyResult = await deleteLegacyMirror({
    category: current.category,
    name: current.name,
    internal_id: current.internal_id,
  })

  const { error: hideErr } = await supabase
    .from('catalog_items')
    .update({ is_active: false, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('id', resolved)
    .eq('is_active', true)

  if (hideErr) throw hideErr

  if (legacyResult === 'fk_blocked') {
    return { mode: 'hidden' as const, detail: 'Item masqué pour ce groupe (historique lié).' }
  }
  if (legacyResult === 'not_found') {
    return { mode: 'hidden' as const, detail: 'Item masqué pour ce groupe.' }
  }
  return { mode: 'deleted' as const, detail: 'Item supprimé pour ce groupe.' }
}



export async function resolveCatalogItemId(itemId: string): Promise<string> {
  const groupId = currentGroupId()

  if (itemId.startsWith('global:')) {
    const globalId = itemId.slice('global:'.length)
    if (!globalId) throw new Error('ID item global invalide.')

    const { data: existing } = await supabase
      .from('catalog_items')
      .select('id')
      .eq('group_id', groupId)
      .eq('internal_id', `global-${globalId}`)
      .maybeSingle<{ id: string }>()
    if (existing?.id) return existing.id

    let globalRow: GlobalCatalogRow | null = null
    let override: GlobalCatalogOverrideRow | null = null

    try {
      const globalRows = await fetchGlobalCatalogItems()
      globalRow = globalRows.find((row) => row.id === globalId) ?? null
    } catch {
      globalRow = null
    }

    if (!globalRow) {
      const [{ data: directRow, error: globalErr }, { data: directOverride }] = await Promise.all([
        supabase
          .from('catalog_items_global')
          .select('id,category,item_type,name,description,image_url,price,default_quantity,weapon_id,created_at')
          .eq('id', globalId)
          .single<GlobalCatalogRow>(),
        supabase
          .from('catalog_items_group_overrides')
          .select('global_item_id,is_hidden,override_name,override_price,override_description,override_image_url,override_item_type,override_weapon_id')
          .eq('group_id', groupId)
          .eq('global_item_id', globalId)
          .maybeSingle<GlobalCatalogOverrideRow>(),
      ])

      if (globalErr || !directRow) throw globalErr || new Error('Item global introuvable.')
      if (directOverride?.is_hidden) throw new Error('Cet item est masqué pour ce groupe.')
      globalRow = directRow
      override = directOverride
    }

    const category = globalRow.category as ItemCategory
    const name = (override?.override_name || globalRow.name || '').trim()
    if (!name) throw new Error('Nom item global invalide.')

    const internal_id = await makeUniqueInternalId(name, (globalRow.internal_id || '').trim() || `global-${globalId}`)
    const buyPrice = toNonNegative(override?.override_price ?? globalRow.price ?? 0)
    const itemTypeRaw = (override?.override_item_type || globalRow.item_type || 'other') as ItemType

    const { data: inserted, error: insertErr } = await supabase
      .from('catalog_items')
      .insert({
        group_id: groupId,
        internal_id,
        name,
        category,
        item_type: normalizeItemType(itemTypeRaw, category),
        description: override?.override_description ?? globalRow.description,
        image_url: override?.override_image_url ?? globalRow.image_url,
        buy_price: buyPrice,
        sell_price: buyPrice,
        internal_value: 0,
        show_in_finance: true,
        is_active: true,
        stock: toNonNegative(globalRow.default_quantity ?? 0),
        low_stock_threshold: 0,
        stackable: true,
        max_stack: 100,
        weight: null,
        fivem_item_id: override?.override_weapon_id ?? globalRow.weapon_id,
        hash: null,
        rarity: null,
      })
      .select('id')
      .single<{ id: string }>()

    if (insertErr) throw insertErr
    return inserted.id
  }

  if (itemId.startsWith('admin:')) {
    const adminItemId = itemId.slice('admin:'.length)
    if (!adminItemId) throw new Error('ID item admin invalide.')

    const { data: existing } = await supabase
      .from('catalog_items')
      .select('id')
      .eq('group_id', groupId)
      .eq('internal_id', `admin-${adminItemId}`)
      .maybeSingle<{ id: string }>()
    if (existing?.id) return existing.id

    const { data: sourceRow, error: sourceErr } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('group_id', 'admin')
      .eq('id', adminItemId)
      .eq('is_active', true)
      .single<CatalogItemRow>()
    if (sourceErr || !sourceRow) throw sourceErr || new Error('Item admin introuvable.')

    const source = mapCatalogItem(sourceRow)
    const internal_id = await makeUniqueInternalId(source.name, `admin-${adminItemId}`)

    const { data: inserted, error: insertErr } = await supabase
      .from('catalog_items')
      .insert({
        group_id: groupId,
        internal_id,
        name: source.name,
        category: source.category,
        item_type: normalizeItemType(source.item_type, source.category),
        description: source.description,
        image_url: source.image_url,
        buy_price: toNonNegative(source.buy_price),
        sell_price: toNonNegative(source.sell_price),
        internal_value: toNonNegative(source.internal_value),
        show_in_finance: source.show_in_finance,
        is_active: true,
        stock: toNonNegative(source.stock),
        low_stock_threshold: toNonNegative(source.low_stock_threshold),
        stackable: source.stackable,
        max_stack: toPositiveInt(source.max_stack),
        weight: source.weight == null ? null : toNonNegative(source.weight),
        fivem_item_id: source.fivem_item_id,
        hash: source.hash,
        rarity: source.rarity,
      })
      .select('id')
      .single<{ id: string }>()

    if (insertErr) throw insertErr
    return inserted.id
  }

  if (!itemId.startsWith('legacy:')) return itemId

  const [, categoryRaw, sourceId] = itemId.split(':')
  const category = categoryRaw as ItemCategory

  if (!sourceId || !category) throw new Error('ID item legacy invalide.')

  const { data: existingCatalog } = await supabase
    .from('catalog_items')
    .select('id')
    .eq('group_id', groupId)
    .eq('category', category)
    .eq('internal_id', itemId.replace(/:/g, '-'))
    .maybeSingle<{ id: string }>()

  if (existingCatalog?.id) return existingCatalog.id

  type LegacySource = {
    name: string
    description: string | null
    image_url: string | null
    stock: number | null
    price: number | null
    item_type: ItemType
  }

  let source: LegacySource | null = null

  if (category === 'objects') {
    const { data, error } = await supabase
      .from('objects')
      .select('name,description,image_url,stock,price')
      .eq('group_id', groupId)
      .eq('id', sourceId)
      .single<{ name: string; description: string | null; image_url: string | null; stock: number | null; price: number | null }>()
    if (error) throw error
    source = { ...data, item_type: 'consumable' }
  } else if (category === 'weapons') {
    const { data, error } = await supabase
      .from('weapons')
      .select('name,description,image_url,stock')
      .eq('group_id', groupId)
      .eq('id', sourceId)
      .single<{ name: string | null; description: string | null; image_url: string | null; stock: number | null }>()
    if (error) throw error
    source = {
      name: data.name?.trim() || 'Arme',
      description: data.description,
      image_url: data.image_url,
      stock: data.stock,
      price: 0,
      item_type: 'weapon',
    }
  } else if (category === 'equipment') {
    const { data, error } = await supabase
      .from('equipment')
      .select('name,description,image_url,stock,price')
      .eq('group_id', groupId)
      .eq('id', sourceId)
      .single<{ name: string; description: string | null; image_url: string | null; stock: number | null; price: number | null }>()
    if (error) throw error
    source = { ...data, item_type: 'equipment' }
  } else if (category === 'drugs') {
    const { data, error } = await supabase
      .from('drug_items')
      .select('name,description,image_url,stock,price,type')
      .eq('group_id', groupId)
      .eq('id', sourceId)
      .single<{ name: string; description: string | null; image_url: string | null; stock: number | null; price: number | null; type: string | null }>()
    if (error) throw error
    source = {
      name: data.name,
      description: data.description,
      image_url: data.image_url,
      stock: data.stock,
      price: data.price,
      item_type: normalizeLegacyDrugType(data.type),
    }
  }

  if (!source) throw new Error('Source item legacy introuvable.')

  const internal_id = await makeUniqueInternalId(source.name, itemId.replace(/:/g, '-'))
  const buyPrice = toNonNegative(source.price)

  const { data: inserted, error: insertErr } = await supabase
    .from('catalog_items')
    .insert({
      group_id: groupId,
      internal_id,
      name: source.name,
      category,
      item_type: source.item_type,
      description: source.description,
      image_url: source.image_url,
      buy_price: buyPrice,
      sell_price: buyPrice,
      internal_value: 0,
      show_in_finance: true,
      is_active: true,
      stock: toNonNegative(source.stock),
      low_stock_threshold: 0,
      stackable: true,
      max_stack: 100,
      weight: null,
      fivem_item_id: null,
      hash: null,
      rarity: null,
    })
    .select('id')
    .single<{ id: string }>()

  if (insertErr) throw insertErr
  return inserted.id
}
export async function createFinanceTransaction(args: {
  item_id: string
  mode: 'buy' | 'sell'
  quantity: number
  unit_price: number
  counterparty?: string
  notes?: string
  payment_mode?: FinancePaymentMode
}) {
  const qty = toPositiveInt(args.quantity)
  const unit = toNonNegative(args.unit_price)
  const totalAmount = calcTotal(qty, unit)
  const resolvedItemId = await resolveCatalogItemId(args.item_id)

  const { data: item, error: itemErr } = await supabase
    .from('catalog_items')
    .select('id,name,stock')
    .eq('group_id', currentGroupId())
    .eq('id', resolvedItemId)
    .single<{ id: string; name: string; stock: number | null }>()

  if (itemErr) throw itemErr

  const currentStock = toNonNegative(item.stock)
  const nextStock = args.mode === 'buy' ? currentStock + qty : currentStock - qty
  if (nextStock < 0) throw new Error(copy.finance.errors.stockInsufficient)

  const { data: cashItem } = await supabase
    .from('catalog_items')
    .select('id,name,stock')
    .eq('group_id', currentGroupId())
    .ilike('name', 'argent')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle<{ id: string; name: string; stock: number | null }>()

  const shouldMoveCash = Boolean(cashItem?.id && cashItem.id !== resolvedItemId && totalAmount > 0)
  if (shouldMoveCash) {
    const currentCash = toNonNegative(cashItem?.stock)
    const nextCash = args.mode === 'sell' ? currentCash + totalAmount : currentCash - totalAmount
    if (nextCash < 0) throw new Error('Argent insuffisant pour cet achat.')
  }

  const isPaymentModeEnumError = (message: string | null | undefined) => String(message || '').toLowerCase().includes('payment_mode')
  async function insertFinanceRow(paymentMode: FinancePaymentMode) {
    const { data, error } = await supabase
      .from('finance_transactions')
      .insert({
        group_id: currentGroupId(),
        item_id: resolvedItemId,
        mode: args.mode,
        quantity: qty,
        unit_price: unit,
        total: totalAmount,
        counterparty: args.counterparty || null,
        notes: args.notes || null,
        payment_mode: paymentMode,
      })
      .select('*')
      .single<FinanceTransaction>()
    if (error) throw error
    return data
  }

  const requestedPaymentMode = (args.payment_mode || 'cash') as FinancePaymentMode
  let data: FinanceTransaction
  try {
    data = await insertFinanceRow(requestedPaymentMode)
  } catch (insertError: unknown) {
    const canFallbackToOther = requestedPaymentMode === 'stock_in' || requestedPaymentMode === 'stock_out'
    if (canFallbackToOther && insertError instanceof Error && isPaymentModeEnumError(insertError.message)) {
      data = await insertFinanceRow('other')
    } else {
      throw insertError
    }
  }

  try {
    const { error: stockErr } = await supabase
      .from('catalog_items')
      .update({ stock: nextStock })
      .eq('group_id', currentGroupId())
      .eq('id', resolvedItemId)
    if (stockErr) throw stockErr
    if (shouldMoveCash) {
      const currentCash = toNonNegative(cashItem?.stock)
      const nextCash = args.mode === 'sell' ? currentCash + totalAmount : currentCash - totalAmount
      const { error: cashErr } = await supabase.from('catalog_items').update({ stock: nextCash }).eq('group_id', currentGroupId()).eq('id', cashItem?.id as string)
      if (cashErr) throw cashErr
    }
  } catch (syncError) {
    await supabase.from('finance_transactions').delete().eq('group_id', currentGroupId()).eq('id', data.id)
    throw syncError
  }

  void createAppLog({
    area: 'finance.transactions',
    action: args.mode,
    message: `${args.mode === 'buy' ? 'Achat' : 'Vente'}: ${item.name} x${qty} (${totalAmount.toFixed(2)} $)`,
    entity_type: 'finance_transaction',
    entity_id: data.id,
    payload: { item_id: resolvedItemId, item_name: item.name, quantity: qty, unit_price: unit, total: totalAmount, cash_item_id: cashItem?.id || null, cash_moved: shouldMoveCash ? totalAmount : 0 },
  })
  return data
}
