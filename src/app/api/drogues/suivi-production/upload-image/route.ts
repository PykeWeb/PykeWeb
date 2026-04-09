import { NextResponse } from 'next/server'
import { requireGroupSession } from '@/server/auth/requireSession'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const BUCKET = 'expense-proofs'
const MAX_UPLOAD_SIZE = 3 * 1024 * 1024

function extFor(file: File) {
  if (file.type.includes('png')) return 'png'
  if (file.type.includes('webp')) return 'webp'
  if (file.type.includes('jpeg') || file.type.includes('jpg')) return 'jpg'
  return 'png'
}

export async function POST(request: Request) {
  try {
    const session = await requireGroupSession(request)
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: 'Image manquante.' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: 'Image trop lourde (max 3 Mo).' }, { status: 413 })
    }

    const supabase = getSupabaseAdmin()
    const path = `transfo/${session.groupId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extFor(file)}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/png',
    })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ publicUrl: data.publicUrl })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload impossible.' }, { status: 400 })
  }
}
