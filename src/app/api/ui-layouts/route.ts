import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireGroupSession } from '@/lib/server/tenantServerSession'

export async function GET() {
  try {
    const session = await requireGroupSession()
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('ui_layouts')
      .select('dashboard_quick_actions,dashboard_cards')
      .eq('group_id', session.groupId)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? { dashboard_quick_actions: [], dashboard_cards: [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Non autorisé' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireGroupSession()
    const body = await request.json()
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('ui_layouts').upsert(
      {
        group_id: session.groupId,
        dashboard_quick_actions: Array.isArray(body.dashboard_quick_actions) ? body.dashboard_quick_actions : [],
        dashboard_cards: Array.isArray(body.dashboard_cards) ? body.dashboard_cards : [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'group_id' }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 400 })
  }
}
