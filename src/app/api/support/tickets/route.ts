import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { requireGroupSession } from '@/lib/server/tenantServerSession'

function getExt(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext) return ext
  return 'png'
}

export async function POST(request: Request) {
  try {
    const session = await requireGroupSession()
    const form = await request.formData()
    const kind = String(form.get('kind') || 'message') as 'bug' | 'message'
    const message = String(form.get('message') || '').trim()
    const image = form.get('image') as File | null

    if (!message) return NextResponse.json({ error: 'Message requis' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data: inserted, error: insertErr } = await supabase
      .from('support_tickets')
      .insert({ group_id: session.groupId, kind, message, status: 'open' })
      .select('id,group_id,kind,message,image_url,status,created_at')
      .single()

    if (insertErr || !inserted) return NextResponse.json({ error: insertErr?.message || 'Insert failed' }, { status: 500 })

    if (!image || image.size === 0) return NextResponse.json(inserted)

    const path = `support/${kind}/${inserted.id}.${getExt(image)}`
    const { error: uploadErr } = await supabase.storage.from('expense-proofs').upload(path, image, {
      upsert: true,
      contentType: image.type || undefined,
    })
    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

    const { data: pub } = supabase.storage.from('expense-proofs').getPublicUrl(path)
    const { data: updated, error: updateErr } = await supabase
      .from('support_tickets')
      .update({ image_url: pub.publicUrl })
      .eq('id', inserted.id)
      .select('id,group_id,kind,message,image_url,status,created_at')
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 401 })
  }
}
