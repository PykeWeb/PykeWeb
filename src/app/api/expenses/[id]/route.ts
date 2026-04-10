import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireGroupSession } from '@/server/auth/requireSession'

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const session = await requireGroupSession(request)
    const id = context.params.id
    const body = await request.json() as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    if (typeof body.member_name === 'string') patch.member_name = body.member_name.trim()
    if (typeof body.item_label === 'string') patch.item_label = body.item_label.trim()
    if (typeof body.description === 'string' || body.description === null) patch.description = body.description
    if (typeof body.status === 'string') patch.status = body.status
    if (body.paid_at === null || typeof body.paid_at === 'string') patch.paid_at = body.paid_at
    if (typeof body.unit_price === 'number') patch.unit_price = Math.max(0, body.unit_price)
    if (typeof body.quantity === 'number') patch.quantity = Math.max(1, Math.floor(body.quantity))
    if (typeof patch.unit_price === 'number' && typeof patch.quantity === 'number') {
      patch.total = Number(patch.unit_price) * Number(patch.quantity)
    }
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('expenses')
      .update(patch)
      .eq('id', id)
      .eq('group_id', session.groupId)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data || data.length === 0) return NextResponse.json({ error: 'Dépense introuvable.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur.' }, { status: 401 })
  }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  try {
    const session = await requireGroupSession(request)
    const id = context.params.id
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('group_id', session.groupId)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data || data.length === 0) return NextResponse.json({ error: 'Dépense introuvable.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur.' }, { status: 401 })
  }
}
