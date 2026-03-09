import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/server/auth/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { TABLET_DAILY_ITEM_OPTIONS, normalizeTabletOptions } from '@/lib/tabletteItems'
import type { TabletCatalogItemConfig } from '@/lib/types/tablette'

type TabletOptionRow = {
  key: string
  name: string
  unit_price: number | null
  max_per_day: number | null
  image_url: string | null
  sort_order: number | null
  is_active: boolean | null
}

function toSafeOption(input: Partial<TabletCatalogItemConfig> & { key?: string }): TabletCatalogItemConfig {
  return {
    key: String(input.key || '').trim(),
    name: String(input.name || '').trim(),
    unit_price: Math.max(0, Number(input.unit_price) || 0),
    max_per_day: Math.max(0, Math.min(100, Math.floor(Number(input.max_per_day) || 0))),
    image_url: input.image_url || null,
  }
}

export async function GET(request: Request) {
  try {
    await assertAdminSession(request)
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('tablet_daily_item_options')
      .select('key,name,unit_price,max_per_day,image_url,sort_order,is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('key', { ascending: true })

    if (error) {
      return NextResponse.json(normalizeTabletOptions(TABLET_DAILY_ITEM_OPTIONS))
    }

    const items = ((data ?? []) as TabletOptionRow[]).map((row) => ({
      key: row.key,
      name: row.name,
      unit_price: Math.max(0, Number(row.unit_price) || 0),
      max_per_day: Math.max(0, Math.floor(Number(row.max_per_day) || 0)),
      image_url: row.image_url || null,
    }))

    return NextResponse.json(normalizeTabletOptions(items))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Non autorisé'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    await assertAdminSession(request)
    const body = (await request.json()) as Partial<TabletCatalogItemConfig>
    const option = toSafeOption(body)
    if (!option.key || !option.name) {
      return NextResponse.json({ error: 'Clé et nom requis.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('tablet_daily_item_options').upsert({
      key: option.key,
      name: option.name,
      unit_price: option.unit_price,
      max_per_day: option.max_per_day,
      image_url: option.image_url,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    await assertAdminSession(request)
    const body = (await request.json()) as { items?: Array<Partial<TabletCatalogItemConfig> & { key?: string }> }
    const items = (body.items ?? []).map(toSafeOption).filter((item) => item.key.length > 0 && item.name.length > 0)
    if (items.length === 0) return NextResponse.json({ error: 'Aucun item valide.' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      const { error } = await supabase.from('tablet_daily_item_options').upsert({
        key: item.key,
        name: item.name,
        unit_price: item.unit_price,
        max_per_day: item.max_per_day,
        image_url: item.image_url,
        sort_order: index,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      if (error) throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    await assertAdminSession(request)
    const { searchParams } = new URL(request.url)
    const key = String(searchParams.get('key') || '').trim()
    if (!key) return NextResponse.json({ error: 'Clé manquante.' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('tablet_daily_item_options')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('key', key)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
