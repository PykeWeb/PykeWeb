import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertAdminSession } from '@/server/auth/admin'
import { toNonNegative } from '@/lib/numberUtils'

type ExportableGroupItem = {
  id: string
  name: string
  category: string
  item_type: string | null
  buy_price: number
  stock: number
  image_url: string | null
  description: string | null
}

type CatalogItemRow = {
  id: string
  name: string
  category: string
  item_type: string | null
  buy_price: number | string | null
  stock: number | string | null
  image_url: string | null
  description: string | null
}

type LegacyObjectRow = {
  id: string
  name: string
  price: number | null
  stock: number | null
  image_url: string | null
  description: string | null
}

type LegacyWeaponRow = {
  id: string
  name: string | null
  weapon_id: string | null
  stock: number | null
  image_url: string | null
  description: string | null
}

type LegacyDrugRow = {
  id: string
  name: string
  type: string | null
  price: number | null
  stock: number | null
  image_url: string | null
  description: string | null
}

function normalizeKey(category: string, name: string): string {
  return `${category}:${name.trim().toLowerCase()}`
}

async function listGroupItems(groupId: string): Promise<ExportableGroupItem[]> {
  const supabase = getSupabaseAdmin()
  const [catalogRes, objectsRes, weaponsRes, equipmentRes, drugsRes, adminObjectsRes] = await Promise.all([
    supabase.from('catalog_items').select('id,name,category,item_type,buy_price,stock,image_url,description').eq('group_id', groupId).eq('is_active', true),
    supabase.from('objects').select('id,name,price,stock,image_url,description').eq('group_id', groupId),
    supabase.from('weapons').select('id,name,weapon_id,stock,image_url,description').eq('group_id', groupId),
    supabase.from('equipment').select('id,name,price,stock,image_url,description').eq('group_id', groupId),
    supabase.from('drug_items').select('id,name,type,price,stock,image_url,description').eq('group_id', groupId),
    supabase.from('objects').select('name').eq('group_id', 'admin'),
  ])

  if (catalogRes.error) throw catalogRes.error
  if (objectsRes.error) throw objectsRes.error
  if (weaponsRes.error) throw weaponsRes.error
  if (equipmentRes.error) throw equipmentRes.error
  if (drugsRes.error) throw drugsRes.error
  if (adminObjectsRes.error) throw adminObjectsRes.error

  const adminObjectNames = new Set(((adminObjectsRes.data ?? []) as { name: string }[]).map((row) => String(row.name || '').trim().toLowerCase()).filter(Boolean))

  const items: ExportableGroupItem[] = ((catalogRes.data ?? []) as CatalogItemRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    item_type: row.item_type,
    buy_price: toNonNegative(row.buy_price),
    stock: toNonNegative(row.stock),
    image_url: row.image_url,
    description: row.description,
  }))

  const seen = new Set(items.map((item) => normalizeKey(item.category, item.name)))

  for (const row of (objectsRes.data ?? []) as LegacyObjectRow[]) {
    const key = normalizeKey('objects', row.name)
    if (seen.has(key)) continue
    items.push({
      id: `legacy-objects-${row.id}`,
      name: row.name,
      category: 'objects',
      item_type: 'consumable',
      buy_price: toNonNegative(row.price),
      stock: toNonNegative(row.stock),
      image_url: row.image_url,
      description: row.description,
    })
    seen.add(key)
  }

  for (const row of (weaponsRes.data ?? []) as LegacyWeaponRow[]) {
    const name = row.name?.trim() || row.weapon_id?.trim() || 'Arme'
    const key = normalizeKey('weapons', name)
    if (seen.has(key)) continue
    items.push({
      id: `legacy-weapons-${row.id}`,
      name,
      category: 'weapons',
      item_type: 'weapon',
      buy_price: 0,
      stock: toNonNegative(row.stock),
      image_url: row.image_url,
      description: row.description,
    })
    seen.add(key)
  }

  for (const row of (equipmentRes.data ?? []) as LegacyObjectRow[]) {
    const key = normalizeKey('equipment', row.name)
    if (seen.has(key)) continue
    items.push({
      id: `legacy-equipment-${row.id}`,
      name: row.name,
      category: 'equipment',
      item_type: 'equipment',
      buy_price: toNonNegative(row.price),
      stock: toNonNegative(row.stock),
      image_url: row.image_url,
      description: row.description,
    })
    seen.add(key)
  }

  for (const row of (drugsRes.data ?? []) as LegacyDrugRow[]) {
    const itemType = row.type === 'pouch' ? 'pouch' : row.type === 'seed' || row.type === 'planting' ? 'seed' : 'drug'
    const key = normalizeKey('drugs', row.name)
    if (seen.has(key)) continue
    items.push({
      id: `legacy-drugs-${row.id}`,
      name: row.name,
      category: 'drugs',
      item_type: itemType,
      buy_price: toNonNegative(row.price),
      stock: toNonNegative(row.stock),
      image_url: row.image_url,
      description: row.description,
    })
    seen.add(key)
  }

  return items
    .filter((item) => !adminObjectNames.has(item.name.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await assertAdminSession(request)
    return NextResponse.json(await listGroupItems(params.id))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Non autorisé'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    await assertAdminSession(request)
    const body = (await request.json()) as { items?: ExportableGroupItem[] }
    const selectedItems = Array.isArray(body.items) ? body.items : []

    if (selectedItems.length === 0) {
      return NextResponse.json({ error: 'Aucun item sélectionné.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    let inserted = 0
    let updated = 0

    for (const item of selectedItems) {
      const safeName = String(item.name || '').trim()
      if (!safeName) continue

      const { data: existing, error: existingError } = await supabase
        .from('objects')
        .select('id,stock,image_url,description,price')
        .eq('group_id', 'admin')
        .ilike('name', safeName)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle<{ id: string; stock: number | null; image_url: string | null; description: string | null; price: number | null }>()

      if (existingError) throw existingError

      const nextPrice = toNonNegative(item.buy_price)
      const nextStock = toNonNegative(item.stock)
      const nextDescription = item.description?.trim() || null
      const nextImageUrl = item.image_url || null

      if (existing?.id) {
        const mergedStock = Math.max(0, Number(existing.stock ?? 0) + nextStock)
        const { error: updateError } = await supabase
          .from('objects')
          .update({
            stock: mergedStock,
            price: nextPrice || toNonNegative(existing.price),
            description: existing.description || nextDescription,
            image_url: existing.image_url || nextImageUrl,
          })
          .eq('group_id', 'admin')
          .eq('id', existing.id)

        if (updateError) throw updateError
        updated += 1
        continue
      }

      const { error: insertError } = await supabase.from('objects').insert({
        group_id: 'admin',
        name: safeName,
        price: nextPrice,
        stock: nextStock,
        description: nextDescription,
        image_url: nextImageUrl,
      })

      if (insertError) throw insertError
      inserted += 1
    }

    return NextResponse.json({ ok: true, inserted, updated })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Non autorisé'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
