import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireGroupSession } from '@/server/auth/requireSession'
import { normalizeCatalogCategory } from '@/lib/catalogConfig'

type GlobalCatalogRow = {
  id: string
  internal_id?: string | null
  category: string
  name: string
  price: number | null
  default_quantity: number | null
  description: string | null
  image_url: string | null
  item_type: string | null
  weapon_id: string | null
  created_at: string
}

type CatalogOverrideRow = {
  global_item_id: string
  is_hidden: boolean | null
  override_name: string | null
  override_price: number | null
  override_description: string | null
  override_image_url: string | null
  override_item_type: string | null
  override_weapon_id: string | null
}

export async function GET(request: Request) {
  try {
    const session = await requireGroupSession(request)
    const { searchParams } = new URL(request.url)
    const category = normalizeCatalogCategory(searchParams.get('category'))

    const supabase = getSupabaseAdmin()
    const [{ data: globals, error: gErr }, { data: overrides, error: oErr }] = await Promise.all([
      category
        ? supabase.from('catalog_items_global').select('*').eq('category', category)
        : supabase.from('catalog_items_global').select('*'),
      supabase.from('catalog_items_group_overrides').select('*').eq('group_id', session.groupId),
    ])
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 })

    const overrideMap = new Map((overrides ?? []).map((o) => [(o as CatalogOverrideRow).global_item_id, o as CatalogOverrideRow]))
    const merged = (globals ?? [])
      .map((row) => {
        const g = row as GlobalCatalogRow
        const ov = overrideMap.get(g.id)
        if (ov?.is_hidden) return null
        return {
          id: `global:${g.id}`,
          global_item_id: g.id,
          internal_id: g.internal_id ?? null,
          category: g.category,
          name: ov?.override_name ?? g.name,
          price: ov?.override_price ?? g.price,
          default_quantity: g.default_quantity,
          description: ov?.override_description ?? g.description,
          image_url: ov?.override_image_url ?? g.image_url,
          item_type: ov?.override_item_type ?? g.item_type,
          weapon_id: ov?.override_weapon_id ?? g.weapon_id,
          is_global: true,
          created_at: g.created_at,
        }
      })
      .filter(Boolean)

    if (process.env.NODE_ENV !== 'production' && merged.length === 0) {
      console.info(`[catalog/items] no rows for category=${category || 'all'} group=${session.groupId}`)
    }

    return NextResponse.json(merged)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Non autorisé'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
