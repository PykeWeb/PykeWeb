import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'

export type DbObject = {
  id: string
  name: string
  price: number
  description?: string | null
  image_url?: string | null
  stock: number
  created_at: string
  is_global?: boolean
  global_item_id?: string
}

const BUCKET = 'object-images'

function getExt(file: File) {
  const byName = file.name.split('.').pop()?.toLowerCase()
  if (byName && byName.length <= 5) return byName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/webp') return 'webp'
  return 'png'
}

export async function listObjects(): Promise<DbObject[]> {
  const groupId = currentGroupId()
  const [{ data: locals, error }, globalRes, hiddenRes] = await Promise.all([
    supabase.from('objects').select('id,name,price,description,image_url,stock,created_at').eq('group_id', groupId).order('created_at', { ascending: false }),
    fetch('/api/catalog/items?category=objects', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])),
    supabase.from('catalog_items').select('name').eq('group_id', currentGroupId()).eq('category', 'objects').eq('is_active', false),
  ])

  if (error) throw error
  const localRows = (locals ?? []) as DbObject[]
  const hiddenNames = new Set(((hiddenRes.data ?? []) as { name: string }[]).map((h) => (h.name || '').toLowerCase()))
  const globalRows = (Array.isArray(globalRes) ? globalRes : []).map((g: any) => ({
    id: `global:${g.global_item_id ?? g.id}`,
    name: g.name,
    price: Number(g.price ?? 0),
    description: g.description,
    image_url: g.image_url,
    stock: 0,
    created_at: g.created_at,
    is_global: true,
    global_item_id: g.global_item_id,
  })) as DbObject[]

  const byName = new Set(localRows.map((o) => (o.name || '').toLowerCase()))
  const visibleLocals = localRows.filter((o) => !hiddenNames.has((o.name || '').toLowerCase()))
  const dedupedGlobals = globalRows.filter((g) => !byName.has((g.name || '').toLowerCase()))
  return [...visibleLocals, ...dedupedGlobals.filter((g) => !hiddenNames.has((g.name || '').toLowerCase()))]
}

export async function createObject(args: {
  name: string
  price: number
  quantity?: number
  description?: string
  imageFile?: File | null
}): Promise<DbObject> {
  const groupId = currentGroupId()
  const quantity = Math.max(1, Math.floor(args.quantity ?? 1))

  const { data: existing } = await supabase.from('objects').select('id,stock').eq('group_id', groupId).eq('name', args.name).maybeSingle()

  if (existing?.id) {
    const { data: bumped, error: bumpErr } = await supabase
      .from('objects')
      .update({ stock: Number(existing.stock ?? 0) + quantity })
      .eq('id', existing.id)
      .eq('group_id', groupId)
      .select('id,name,price,description,image_url,stock,created_at')
      .single()
    if (bumpErr) throw bumpErr
    return bumped as DbObject
  }

  const { data: inserted, error: insertError } = await supabase
    .from('objects')
    .insert({ group_id: groupId, name: args.name, price: args.price, stock: quantity, description: args.description || null })
    .select('id,name,price,description,image_url,stock,created_at')
    .single()

  if (insertError) throw insertError
  if (!inserted) throw new Error('Insert failed')

  if (args.imageFile) {
    const ext = getExt(args.imageFile)
    const path = `${inserted.id}/main.${ext}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, args.imageFile, { upsert: true, contentType: args.imageFile.type || undefined })
    if (uploadError) throw uploadError

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const image_url = publicData.publicUrl

    const { data: updated, error: updateError } = await supabase
      .from('objects')
      .update({ image_url })
      .eq('id', inserted.id)
      .select('id,name,price,description,image_url,stock,created_at')
      .single()

    if (updateError) throw updateError
    return updated as DbObject
  }

  return inserted as DbObject
}

export async function updateObject(args: { id: string; name: string; price: number; quantity?: number; imageFile?: File | null }) {
  const quantity = Math.max(0, Math.floor(Number(args.quantity ?? 0) || 0))
  if (args.id.startsWith('global:')) {
    const globalId = args.id.replace('global:', '')
    const res = await fetch('/api/catalog/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_item_id: globalId, override_name: args.name, override_price: args.price, override_quantity: quantity, is_hidden: false }),
    })
    if (!res.ok) throw new Error(await res.text())
    return
  }

  const { data: updatedBase, error: baseErr } = await supabase
    .from('objects')
    .update({ name: args.name, price: args.price, stock: quantity })
    .eq('id', args.id)
    .eq('group_id', currentGroupId())
    .select('id,name,price,description,image_url,stock,created_at')
    .single()

  if (baseErr) throw baseErr

  if (args.imageFile) {
    const ext = getExt(args.imageFile)
    const path = `${args.id}/main.${ext}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, args.imageFile, { upsert: true, contentType: args.imageFile.type || undefined })
    if (uploadError) throw uploadError

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const image_url = publicData.publicUrl

    const { data: updatedWithImage, error: imageErr } = await supabase
      .from('objects')
      .update({ image_url })
      .eq('id', args.id)
      .eq('group_id', currentGroupId())
      .select('id,name,price,description,image_url,stock,created_at')
      .single()

    if (imageErr) throw imageErr
    return updatedWithImage as DbObject
  }

  return updatedBase as DbObject
}

export async function deleteObject(objectId: string) {
  if (objectId.startsWith('global:')) {
    const globalId = objectId.replace('global:', '')
    const res = await fetch('/api/catalog/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ global_item_id: globalId, is_hidden: true }),
    })
    if (!res.ok) throw new Error(await res.text())
    return
  }
  const groupId = currentGroupId()
  const { data: row } = await supabase.from('objects').select('id,name').eq('id', objectId).eq('group_id', groupId).maybeSingle<{ id: string; name: string }>()
  const { error } = await supabase.from('objects').delete().eq('id', objectId).eq('group_id', groupId)
  if (!error) return

  if (error.code === '23503' && row?.name) {
    const internal_id = `legacy-objects-${row.id}`
    const { data: existing } = await supabase
      .from('catalog_items')
      .select('id')
      .eq('group_id', groupId)
      .eq('internal_id', internal_id)
      .maybeSingle<{ id: string }>()

    if (existing?.id) {
      await supabase.from('catalog_items').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', existing.id).eq('group_id', groupId)
    } else {
      await supabase.from('catalog_items').insert({
        group_id: groupId,
        internal_id,
        name: row.name,
        category: 'objects',
        item_type: 'other',
        buy_price: 0,
        sell_price: 0,
        internal_value: 0,
        show_in_finance: false,
        is_active: false,
        stock: 0,
        low_stock_threshold: 0,
        stackable: true,
        max_stack: 100,
      })
    }
    return
  }

  throw error
}
