import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'

export type DbEquipment = {
  id: string
  name: string
  price: number
  description?: string | null
  image_url?: string | null
  stock: number
  created_at: string
}

const BUCKET = 'equipment-images'

function getExt(file: File) {
  const byName = file.name.split('.').pop()?.toLowerCase()
  if (byName && byName.length <= 5) return byName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/webp') return 'webp'
  return 'png'
}

export async function listEquipment(): Promise<DbEquipment[]> {
  const [{ data, error }, globalRes] = await Promise.all([
    supabase.from('equipment').select('id,name,price,description,image_url,stock,created_at').eq('group_id', currentGroupId()).order('created_at', { ascending: false }),
    fetch('/api/catalog/items?category=equipment', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
  ])
  if (error) throw error
  const locals = (data ?? []) as DbEquipment[]
  const names = new Set(locals.map((w) => (w.name || '').toLowerCase()))
  const globals = (Array.isArray(globalRes) ? globalRes : []).map((g: any) => ({ id: `global:${g.global_item_id ?? g.id}`, name: g.name, price: Number(g.price ?? 0), description: g.description, image_url: g.image_url, stock: 0, created_at: g.created_at })) as DbEquipment[]
  return [...locals, ...globals.filter((g) => !names.has((g.name || '').toLowerCase()))]
}

export async function createEquipment(args: {
  name: string
  price: number
  quantity?: number
  description?: string
  imageFile?: File | null
}): Promise<DbEquipment> {
  const groupId = currentGroupId()
  const quantity = Math.max(1, Math.floor(args.quantity ?? 1))

  const { data: existing } = await supabase
    .from('equipment')
    .select('id,stock')
    .eq('group_id', groupId)
    .eq('name', args.name)
    .maybeSingle()

  if (existing?.id) {
    const { data: bumped, error: bumpErr } = await supabase
      .from('equipment')
      .update({ stock: Number(existing.stock ?? 0) + quantity })
      .eq('id', existing.id)
      .eq('group_id', groupId)
      .select('id,name,price,description,image_url,stock,created_at')
      .single()
    if (bumpErr) throw bumpErr
    return bumped as DbEquipment
  }

  const { data: inserted, error: insertError } = await supabase
    .from('equipment')
    .insert({
      group_id: groupId,
      name: args.name,
      price: args.price,
      stock: quantity,
      description: args.description || null,
    })
    .select('id,name,price,description,image_url,stock,created_at')
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
      .from('equipment')
      .update({ image_url })
      .eq('id', inserted.id)
      .select('id,name,price,description,image_url,stock,created_at')
      .single()
    if (updateError) throw updateError
    return updated as DbEquipment
  }

  return inserted as DbEquipment
}

export async function adjustEquipmentStock(args: { equipmentId: string; delta: number; note?: string }) {
  if (args.equipmentId.startsWith('global:')) throw new Error('Stock des items globaux: crée un item local ou override dédié.')
  const { data: row, error: getErr } = await supabase.from('equipment').select('id,stock').eq('id', args.equipmentId).eq('group_id', currentGroupId()).single()
  if (getErr) throw getErr
  const current = row?.stock ?? 0
  const next = current + args.delta
  if (next < 0) throw new Error('Stock insuffisant')

  const { error: updErr } = await supabase.from('equipment').update({ stock: next }).eq('id', args.equipmentId).eq('group_id', currentGroupId())
  if (updErr) throw updErr

  try {
    await supabase.from('equipment_stock_movements').insert({
      equipment_id: args.equipmentId,
      group_id: currentGroupId(),
      delta: args.delta,
      note: args.note || null,
    })
  } catch {
    // ignore if table not created yet
  }

  return next
}

export async function updateEquipment(args: {
  id: string
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
      body: JSON.stringify({ global_item_id: args.id.replace('global:', ''), override_name: args.name, override_price: args.price, override_quantity: quantity, is_hidden: false }),
    })
    if (!res.ok) throw new Error(await res.text())
    return
  }

  const { data: updatedBase, error: baseErr } = await supabase
    .from('equipment')
    .update({
      name: args.name,
      price: args.price,
      stock: quantity,
      description: args.description || null,
    })
    .eq('id', args.id)
    .eq('group_id', currentGroupId())
    .select('id,name,price,description,image_url,stock,created_at')
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
      .from('equipment')
      .update({ image_url: publicData.publicUrl })
      .eq('id', args.id)
    .eq('group_id', currentGroupId())
      .select('id,name,price,description,image_url,stock,created_at')
      .single()
    if (imageErr) throw imageErr
    return updatedWithImage as DbEquipment
  }

  return updatedBase as DbEquipment
}

export async function deleteEquipment(equipmentId: string) {
  if (equipmentId.startsWith('global:')) {
    const res = await fetch('/api/catalog/overrides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ global_item_id: equipmentId.replace('global:', ''), is_hidden: true }) })
    if (!res.ok) throw new Error(await res.text())
    return
  }
  const { error } = await supabase.from('equipment').delete().eq('id', equipmentId).eq('group_id', currentGroupId())
  if (error) throw error
}
