import { supabase } from '@/lib/supabaseClient'

export type DbObject = {
  id: string
  name: string
  price: number
  description?: string | null
  image_url?: string | null
  stock: number
  created_at: string
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
  const { data, error } = await supabase
    .from('objects')
    .select('id,name,price,description,image_url,stock,created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as DbObject[]
}

export async function createObject(args: {
  name: string
  price: number
  description?: string
  imageFile?: File | null
}): Promise<DbObject> {
  // 1) Create the row first (so we get the id)
  const { data: inserted, error: insertError } = await supabase
    .from('objects')
    .insert({
      name: args.name,
      price: args.price,
      description: args.description || null,
    })
    .select('id,name,price,description,image_url,stock,created_at')
    .single()

  if (insertError) throw insertError
  if (!inserted) throw new Error('Insert failed')

  // 2) Optional image upload
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


export async function updateObject(args: {
  id: string
  name: string
  price: number
  imageFile?: File | null
}) {
  const { data: updatedBase, error: baseErr } = await supabase
    .from('objects')
    .update({
      name: args.name,
      price: args.price,
    })
    .eq('id', args.id)
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
    const image_url = publicData.publicUrl

    const { data: updatedWithImage, error: imageErr } = await supabase
      .from('objects')
      .update({ image_url })
      .eq('id', args.id)
      .select('id,name,price,description,image_url,stock,created_at')
      .single()

    if (imageErr) throw imageErr
    return updatedWithImage as DbObject
  }

  return updatedBase as DbObject
}
