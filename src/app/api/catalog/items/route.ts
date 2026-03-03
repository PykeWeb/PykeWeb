import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireGroupSession } from '@/lib/server/tenantServerSession'

export async function GET(request: Request) {
  try {
    const session = await requireGroupSession()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    if (!category) return NextResponse.json({ error: 'category requis' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const [{ data: globals, error: gErr }, { data: overrides, error: oErr }] = await Promise.all([
      supabase.from('catalog_items_global').select('*').eq('category', category),
      supabase.from('catalog_items_group_overrides').select('*').eq('group_id', session.groupId),
    ])
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 })

    const overrideMap = new Map((overrides ?? []).map((o: any) => [o.global_item_id, o]))
    const merged = (globals ?? [])
      .map((g: any) => {
        const ov = overrideMap.get(g.id)
        if (ov?.is_hidden) return null
        return {
          id: `global:${g.id}`,
          global_item_id: g.id,
          category: g.category,
          name: ov?.override_name ?? g.name,
          price: ov?.override_price ?? g.price,
          description: ov?.override_description ?? g.description,
          image_url: ov?.override_image_url ?? g.image_url,
          item_type: ov?.override_item_type ?? g.item_type,
          weapon_id: ov?.override_weapon_id ?? g.weapon_id,
          is_global: true,
          created_at: g.created_at,
        }
      })
      .filter(Boolean)

    return NextResponse.json(merged)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Non autorisé' }, { status: 401 })
  }
}
