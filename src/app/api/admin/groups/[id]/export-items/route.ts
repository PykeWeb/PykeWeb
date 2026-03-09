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


function isMissingTableError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false
  const message = String(error.message || '').toLowerCase()
  return message.includes('does not exist') || message.includes('relation') || message.includes('not found')
}

async function selectRows<T>(query: PromiseLike<{ data: T[] | null; error: { message?: string; code?: string } | null }>, fallbackWhenMissing = false): Promise<T[]> {
  const result = await query
  if (result.error) {
    if (fallbackWhenMissing && isMissingTableError(result.error)) return []
    throw new Error(result.error.message || 'Erreur de lecture des items groupe')
  }
  return result.data ?? []
}



async function resolveAdminGroupId(): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tenant_groups')
    .select('id')
    .eq('login', 'admin')
    .maybeSingle<{ id: string }>()

  if (error) throw new Error(error.message)
  if (!data?.id) throw new Error('Groupe admin introuvable.')
  return data.id
}

async function listGroupItems(groupId: string): Promise<ExportableGroupItem[]> {
  const supabase = getSupabaseAdmin()
  const adminGroupId = await resolveAdminGroupId()
  const [catalogRows, objectRows, weaponRows, equipmentRows, drugRows, adminObjectRows] = await Promise.all([
    selectRows<CatalogItemRow>(supabase.from('catalog_items').select('id,name,category,item_type,buy_price,stock,image_url,description').eq('group_id', groupId).eq('is_active', true), true),
    selectRows<LegacyObjectRow>(supabase.from('objects').select('id,name,price,stock,image_url,description').eq('group_id', groupId), true),
    selectRows<LegacyWeaponRow>(supabase.from('weapons').select('id,name,weapon_id,stock,image_url,description').eq('group_id', groupId), true),
    selectRows<LegacyObjectRow>(supabase.from('equipment').select('id,name,price,stock,image_url,description').eq('group_id', groupId), true),
    selectRows<LegacyDrugRow>(supabase.from('drug_items').select('id,name,type,price,stock,image_url,description').eq('group_id', groupId), true),
    selectRows<{ name: string }>(supabase.from('objects').select('name').eq('group_id', adminGroupId), true),
  ])

  const adminObjectNames = new Set(adminObjectRows.map((row) => String(row.name || '').trim().toLowerCase()).filter(Boolean))

  const items: ExportableGroupItem[] = catalogRows.map((row) => ({
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

  for (const row of objectRows) {
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

  for (const row of weaponRows) {
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

  for (const row of equipmentRows) {
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

  for (const row of drugRows) {
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
    const status = message.toLowerCase().includes('autorisé') || message.toLowerCase().includes('session') ? 401 : 400
    return NextResponse.json({ error: message }, { status })
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
    const adminGroupId = await resolveAdminGroupId()
    let inserted = 0
    let updated = 0

    for (const item of selectedItems) {
      const safeName = String(item.name || '').trim()
      if (!safeName) continue

      const { data: existing, error: existingError } = await supabase
        .from('objects')
        .select('id,stock,image_url,description,price')
        .eq('group_id', adminGroupId)
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
          .eq('group_id', adminGroupId)
          .eq('id', existing.id)

        if (updateError) throw updateError
        updated += 1
        continue
      }

      const { error: insertError } = await supabase.from('objects').insert({
        group_id: adminGroupId,
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
    const status = message.toLowerCase().includes('autorisé') || message.toLowerCase().includes('session') ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
