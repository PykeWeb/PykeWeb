import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { requireGroupSession } from '@/lib/server/tenantServerSession'

export async function POST(request: Request) {
  try {
    const session = await requireGroupSession()
    const body = await request.json()
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('catalog_items_group_overrides')
      .upsert(
        {
          group_id: session.groupId,
          global_item_id: body.global_item_id,
          override_name: body.override_name ?? null,
          override_price: body.override_price ?? null,
          override_description: body.override_description ?? null,
          override_image_url: body.override_image_url ?? null,
          override_item_type: body.override_item_type ?? null,
          override_weapon_id: body.override_weapon_id ?? null,
          is_hidden: body.is_hidden ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'group_id,global_item_id' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireGroupSession()
    const body = await request.json()
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('catalog_items_group_overrides')
      .delete()
      .eq('group_id', session.groupId)
      .eq('global_item_id', body.global_item_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 400 })
  }
}
