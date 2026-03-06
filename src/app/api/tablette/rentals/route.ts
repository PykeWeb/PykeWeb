import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireGroupSession } from '@/server/auth/requireSession'
import { buildTabletMessage, normalizeWeeks, parseTabletMessage, TABLET_WEEKLY_PRICE } from '@/lib/tabletRental'

function getExt(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext) return ext
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  return 'png'
}

export async function GET(request: Request) {
  try {
    const session = await requireGroupSession(request)
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id,group_id,message,image_url,status,created_at')
      .eq('group_id', session.groupId)
      .eq('kind', 'message')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data ?? [])
      .map((row) => {
        const parsed = parseTabletMessage(String(row.message || ''))
        if (!parsed) return null
        return {
          id: row.id,
          group_id: row.group_id,
          weeks: parsed.weeks,
          amount: parsed.amount,
          image_url: row.image_url,
          status: row.status === 'resolved' ? 'resolved' : 'open',
          created_at: row.created_at,
        }
      })
      .filter(Boolean)

    return NextResponse.json(rows)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Non autorisé'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireGroupSession(request)
    const form = await request.formData()
    const proof = form.get('proof')
    const weeks = normalizeWeeks(form.get('weeks'))
    if (!(proof instanceof File) || proof.size === 0) {
      return NextResponse.json({ error: 'Preuve requise (png/jpg).' }, { status: 400 })
    }

    const amount = weeks * TABLET_WEEKLY_PRICE
    const supabase = getSupabaseAdmin()

    const { data: inserted, error: insertErr } = await supabase
      .from('support_tickets')
      .insert({
        group_id: session.groupId,
        kind: 'message',
        message: buildTabletMessage({ weeks, amount }),
        status: 'open',
      })
      .select('id,group_id,message,image_url,status,created_at')
      .single()

    if (insertErr || !inserted) return NextResponse.json({ error: insertErr?.message || 'Insertion impossible' }, { status: 500 })

    const path = `tablette/${session.groupId}/${inserted.id}.${getExt(proof)}`
    const { error: uploadErr } = await supabase.storage.from('expense-proofs').upload(path, proof, {
      upsert: true,
      contentType: proof.type || undefined,
    })
    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

    const { data: pub } = supabase.storage.from('expense-proofs').getPublicUrl(path)
    const { data: updated, error: updateErr } = await supabase
      .from('support_tickets')
      .update({ image_url: pub.publicUrl })
      .eq('id', inserted.id)
      .select('id,group_id,message,image_url,status,created_at')
      .single()

    if (updateErr || !updated) return NextResponse.json({ error: updateErr?.message || 'Update impossible' }, { status: 500 })

    return NextResponse.json({
      id: updated.id,
      group_id: updated.group_id,
      weeks,
      amount,
      image_url: updated.image_url,
      status: updated.status === 'resolved' ? 'resolved' : 'open',
      created_at: updated.created_at,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
