import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'

export type DrugKind = 'drug' | 'seed' | 'planting' | 'pouch' | 'other'

export type DbDrugItem = {
  id: string
  type: DrugKind
  name: string
  price: number
  description?: string | null
  image_url?: string | null
  stock: number
  created_at: string
}

const BUCKET = 'drug-images'

function getExt(file: File) {
  const byName = file.name.split('.').pop()?.toLowerCase()
  if (byName && byName.length <= 5) return byName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/webp') return 'webp'
  return 'png'
}

export async function listDrugItems(): Promise<DbDrugItem[]> {
  const [{ data, error }, globalRes] = await Promise.all([
    supabase.from('drug_items').select('id,type,name,price,description,image_url,stock,created_at').eq('group_id', currentGroupId()).order('created_at', { ascending: false }),
    fetch('/api/catalog/items?category=drug', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
  ])
  if (error) throw error
  const locals = (data ?? []) as DbDrugItem[]
  const names = new Set(locals.map((w) => (w.name || '').toLowerCase()))
  const globals = (Array.isArray(globalRes) ? globalRes : []).map((g: any) => ({ id: `global:${g.global_item_id ?? g.id}`, type: (g.item_type || 'other') as DrugKind, name: g.name, price: Number(g.price ?? 0), description: g.description, image_url: g.image_url, stock: 0, created_at: g.created_at })) as DbDrugItem[]
  return [...locals, ...globals.filter((g) => !names.has((g.name || '').toLowerCase()))]
}

export async function createDrugItem(args: {
  type: DrugKind
  name: string
  price: number
  quantity?: number
  description?: string
  imageFile?: File | null
}): Promise<DbDrugItem> {
  const groupId = currentGroupId()
  const quantity = Math.max(1, Math.floor(args.quantity ?? 1))

  const { data: existing } = await supabase
    .from('drug_items')
    .select('id,stock')
    .eq('group_id', groupId)
    .eq('name', args.name)
    .eq('type', args.type)
    .maybeSingle()

  if (existing?.id) {
    const { data: bumped, error: bumpErr } = await supabase
      .from('drug_items')
      .update({ stock: Number(existing.stock ?? 0) + quantity })
      .eq('id', existing.id)
      .eq('group_id', groupId)
      .select('id,type,name,price,description,image_url,stock,created_at')
      .single()
    if (bumpErr) throw bumpErr
    return bumped as DbDrugItem
  }

  const { data: inserted, error: insertError } = await supabase
    .from('drug_items')
    .insert({
      group_id: groupId,
      type: args.type,
      name: args.name,
      price: args.price,
      stock: quantity,
      description: args.description || null,
    })
    .select('id,type,name,price,description,image_url,stock,created_at')
    .single()

  if (insertError) throw insertError
  if (!inserted) throw new Error('Insert failed')

  if (args.imageFile) {
    const ext = getExt(args.imageFile)
    const path = `${inserted.id}/main.${ext}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, args.imageFile, {
      upsert: true,
      contentType: args.imageFile.type || undefined,
    })
    if (uploadError) throw uploadError

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const image_url = publicData.publicUrl

    const { data: updated, error: updateError } = await supabase
      .from('drug_items')
      .update({ image_url })
      .eq('id', inserted.id)
      .select('id,type,name,price,description,image_url,stock,created_at')
      .single()
    if (updateError) throw updateError
    return updated as any
  }

  return inserted as any
}

export async function adjustDrugStock(args: { itemId: string; delta: number; note?: string }) {
  if (args.itemId.startsWith('global:')) throw new Error('Stock des items globaux: crée un item local ou override dédié.')
  const { data: row, error: getErr } = await supabase.from('drug_items').select('id,stock').eq('id', args.itemId).eq('group_id', currentGroupId()).single()
  if (getErr) throw getErr
  const current = row?.stock ?? 0
  const next = current + args.delta
  if (next < 0) throw new Error('Stock insuffisant')

  const { error: updErr } = await supabase.from('drug_items').update({ stock: next }).eq('id', args.itemId).eq('group_id', currentGroupId())
  if (updErr) throw updErr

  try {
    await supabase.from('drug_stock_movements').insert({
      drug_item_id: args.itemId,
      group_id: currentGroupId(),
      delta: args.delta,
      note: args.note || null,
    })
  } catch {
    // ignore
  }

  return next
}

export async function updateDrugItem(args: {
  id: string
  type: DrugKind
  name: string
  price: number
  quantity?: number
  description?: string | null
  imageFile?: File | null
}) {
  const quantity = Math.max(0, Math.floor(Number(args.quantity ?? 0) || 0))
  if (args.id.startsWith('global:')) {
    const res = await fetch('/api/catalog/overrides', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_item_id: args.id.replace('global:', ''), override_name: args.name, override_price: args.price, override_item_type: args.type, override_quantity: quantity, is_hidden: false }),
    })
    if (!res.ok) throw new Error(await res.text())
    return
  }

  const { data: updatedBase, error: baseErr } = await supabase
    .from('drug_items')
    .update({
      type: args.type,
      name: args.name,
      price: args.price,
      stock: quantity,
      description: args.description || null,
    })
    .eq('id', args.id)
    .eq('group_id', currentGroupId())
    .select('id,type,name,price,description,image_url,stock,created_at')
    .single()

  if (baseErr) throw baseErr

  if (args.imageFile) {
    const ext = getExt(args.imageFile)
    const path = `${args.id}/main.${ext}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, args.imageFile, {
      upsert: true,
      contentType: args.imageFile.type || undefined,
    })
    if (uploadError) throw uploadError

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const { data: updatedWithImage, error: imageErr } = await supabase
      .from('drug_items')
      .update({ image_url: publicData.publicUrl })
      .eq('id', args.id)
    .eq('group_id', currentGroupId())
      .select('id,type,name,price,description,image_url,stock,created_at')
      .single()
    if (imageErr) throw imageErr
    return updatedWithImage as DbDrugItem
  }

  return updatedBase as DbDrugItem
}

export async function deleteDrugItem(itemId: string) {
  if (itemId.startsWith('global:')) {
    const res = await fetch('/api/catalog/overrides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ global_item_id: itemId.replace('global:', ''), is_hidden: true }) })
    if (!res.ok) throw new Error(await res.text())
    return
  }
  const { error } = await supabase.from('drug_items').delete().eq('id', itemId).eq('group_id', currentGroupId())
  if (error) throw error
}
