import { supabase } from '@/lib/supabaseClient'
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
  const { data, error } = await supabase
    .from('equipment')
    .select('id,name,price,description,image_url,stock,created_at')
    .eq('group_id', currentGroupId())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbEquipment[]
}

export async function createEquipment(args: {
  name: string
  price: number
  description?: string
  imageFile?: File | null
}): Promise<DbEquipment> {
  const { data: inserted, error: insertError } = await supabase
    .from('equipment')
    .insert({
      group_id: currentGroupId(),
      name: args.name,
      price: args.price,
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
  description?: string | null
  imageFile?: File | null
}) {
  const { data: updatedBase, error: baseErr } = await supabase
    .from('equipment')
    .update({
      name: args.name,
      price: args.price,
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
  const { error } = await supabase.from('equipment').delete().eq('id', equipmentId).eq('group_id', currentGroupId())
  if (error) throw error
}
