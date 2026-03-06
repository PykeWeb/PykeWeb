import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'
import { toNonNegative, toPositiveInt, calcTotal } from '@/lib/numberUtils'
import { copy } from '@/lib/copy'
import { getSuggestedInternalId } from '@/lib/itemId'
import type { CatalogItem, FinancePaymentMode, FinanceTransaction, ItemCategory, ItemRarity, ItemType } from '@/lib/types/itemsFinance'
import { normalizeItemType } from '@/lib/catalogConfig'

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

export async function listCatalogItems(includeInactive = false): Promise<CatalogItem[]> {
  let query = supabase.from('catalog_items').select('*').eq('group_id', currentGroupId())
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => mapCatalogItem(row as CatalogItemRow))
}




type GlobalCatalogRow = {
  id: string
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
  if (raw === 'seed' || raw === 'planting') return 'seed'
  if (raw === 'pouch') return 'pouch'
  if (raw === 'drug') return 'product'
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
      ? Promise.resolve({ data: [], error: null })
      : supabase.from('catalog_items_global').select('id,category,item_type,name,description,image_url,price,default_quantity,weapon_id,created_at'),
    groupId === 'admin'
      ? Promise.resolve({ data: [], error: null })
      : supabase.from('catalog_items_group_overrides').select('global_item_id,is_hidden,override_name,override_price,override_description,override_image_url,override_item_type,override_weapon_id').eq('group_id', groupId),
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
  const byName = new Set(catalogItems.map((x) => `${x.category}:${x.name.trim().toLowerCase()}`))
  const hiddenNames = new Set(((hiddenRes.data ?? []) as { name: string; category: ItemCategory }[]).map((x) => `${x.category}:${x.name.trim().toLowerCase()}`))

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
    const key = `${item.category}:${item.name.trim().toLowerCase()}`
    return !byName.has(key) && !hiddenNames.has(key)
  })

  const overrideMap = new Map(((overridesRes.data ?? []) as GlobalCatalogOverrideRow[]).map((row) => [row.global_item_id, row]))
  const globalItems = ((globalRes.data ?? []) as GlobalCatalogRow[])
    .map((row) => {
      const override = overrideMap.get(row.id)
      if (override?.is_hidden) return null
      const category = row.category as ItemCategory
      const name = (override?.override_name || row.name || '').trim()
      if (!name) return null
      const key = `${category}:${name.toLowerCase()}`
      if (byName.has(key) || hiddenNames.has(key)) return null
      const buyPrice = toNonNegative(override?.override_price ?? row.price ?? 0)
      const itemTypeRaw = (override?.override_item_type || row.item_type || 'other') as ItemType
      const itemType = normalizeItemType(itemTypeRaw, category)
      return {
        id: `global:${row.id}`,
        group_id: groupId,
        internal_id: `global-${row.id}`,
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

  return [...catalogItems, ...mergedLegacy, ...globalItems].sort((a, b) => b.created_at.localeCompare(a.created_at))
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

  if (group_id === 'admin') {
    const { error: globalError } = await supabase.from('catalog_items_global').insert({
      category: args.category,
      item_type: normalizeItemType(args.item_type, args.category),
      name: args.name,
      description: args.description || null,
      image_url: inserted.image_url || null,
      price: toNonNegative(args.buy_price),
      default_quantity: toNonNegative(args.stock),
      weapon_id: args.fivem_item_id || null,
    })
    if (globalError) {
      console.warn('[items:create] global insert skipped', globalError.message)
    }
  }

  return mapCatalogItem(inserted)
}

export async function updateCatalogItem(args: UpdateCatalogItemInput) {
  const resolved = await ensureCatalogItemId(args.id)
  const { data: current } = await supabase
    .from('catalog_items')
    .select('name,internal_id,category')
    .eq('group_id', currentGroupId())
    .eq('id', resolved)
    .maybeSingle<{ name: string; internal_id: string | null; category: ItemCategory }>()

  const { data, error } = await supabase
    .from('catalog_items')
    .update({
      name: args.name,
      category: args.category,
      item_type: normalizeItemType(args.item_type, args.category),
      description: args.description || null,
      buy_price: toNonNegative(args.buy_price),
      sell_price: toNonNegative(args.sell_price),
      stock: toNonNegative(args.stock),
      fivem_item_id: args.fivem_item_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('group_id', currentGroupId())
    .eq('id', resolved)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) throw new Error('Impossible de modifier: item introuvable ou non autorisé.')

  await upsertLegacyMirror({
    category: args.category,
    name: args.name,
    description: args.description,
    buy_price: args.buy_price,
    stock: args.stock,
    item_type: args.item_type,
    lookupName: current?.name,
  })
}

export async function deleteCatalogItem(itemId: string) {
  const resolved = await ensureCatalogItemId(itemId)
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



async function ensureCatalogItemId(itemId: string): Promise<string> {
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

    const [{ data: globalRow, error: globalErr }, { data: override }] = await Promise.all([
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

    if (globalErr || !globalRow) throw globalErr || new Error('Item global introuvable.')
    if (override?.is_hidden) throw new Error('Cet item est masqué pour ce groupe.')

    const category = globalRow.category as ItemCategory
    const name = (override?.override_name || globalRow.name || '').trim()
    if (!name) throw new Error('Nom item global invalide.')

    const internal_id = await makeUniqueInternalId(name, `global-${globalId}`)
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
  const resolvedItemId = await ensureCatalogItemId(args.item_id)

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

  const { error: stockErr } = await supabase.from('catalog_items').update({ stock: nextStock }).eq('group_id', currentGroupId()).eq('id', resolvedItemId)
  if (stockErr) throw stockErr

  const { data, error } = await supabase
    .from('finance_transactions')
    .insert({
      group_id: currentGroupId(),
      item_id: resolvedItemId,
      mode: args.mode,
      quantity: qty,
      unit_price: unit,
      total: calcTotal(qty, unit),
      counterparty: args.counterparty || null,
      notes: args.notes || null,
      payment_mode: args.payment_mode || 'cash',
    })
    .select('*')
    .single<FinanceTransaction>()

  if (error) throw error
  return data
}
