import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertAdminSession } from '@/server/auth/admin'

const BUCKET = 'tablette-item-images'

async function ensureBucket() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage.listBuckets()
  if (error) throw new Error(error.message)
  const exists = (data ?? []).some((bucket) => bucket.name === BUCKET)
  if (exists) return

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  })
  if (createError) throw new Error(createError.message)
}

export async function POST(request: Request) {
  try {
    await assertAdminSession(request)
    await ensureBucket()

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 })
    }

    const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg'
    const path = `tablette/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const supabase = getSupabaseAdmin()

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ publicUrl: data.publicUrl })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Upload impossible'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
