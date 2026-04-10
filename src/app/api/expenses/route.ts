import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireGroupSession } from '@/server/auth/requireSession'

export async function GET(request: Request) {
  try {
    const session = await requireGroupSession(request)
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('expenses')
      .select('id,member_name,item_source,item_id,item_label,unit_price,unit_price_override,quantity,total,description,proof_image_url,status,created_at,paid_at')
      .eq('group_id', session.groupId)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ rows: data ?? [] })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur.' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireGroupSession(request)
    const body = await request.json() as {
      member_name?: string
      item_source?: string
      item_id?: string | null
      item_label?: string
      unit_price?: number
      unit_price_override?: number | null
      quantity?: number
      total?: number
      description?: string | null
      proof_image_url?: string | null
    }
    const supabase = getSupabaseAdmin()
    const payload = {
      group_id: session.groupId,
      member_name: String(body.member_name || '').trim(),
      item_source: String(body.item_source || 'custom'),
      item_id: body.item_id || null,
      item_label: String(body.item_label || '').trim(),
      unit_price: Number(body.unit_price || 0),
      unit_price_override: body.unit_price_override == null ? null : Number(body.unit_price_override),
      quantity: Math.max(1, Math.floor(Number(body.quantity || 1))),
      total: Number(body.total || 0),
      description: body.description || null,
      proof_image_url: body.proof_image_url || null,
      status: 'pending',
    }
    const { data, error } = await supabase
      .from('expenses')
      .insert(payload)
      .select('id,member_name,item_source,item_id,item_label,unit_price,unit_price_override,quantity,total,description,proof_image_url,status,created_at,paid_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ row: data })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur.' }, { status: 401 })
  }
}
