import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireGroupSession } from '@/server/auth/requireSession'
import { TABLET_DAILY_ITEM_OPTIONS, toDayKey } from '@/lib/tabletteItems'
import type { TabletDailyRun, TabletSubmitPayload } from '@/lib/types/tablette'

type TabletDailyRunRow = {
  id: string
  group_id: string
  member_name: string
  member_name_normalized: string
  day_key: string
  disqueuse_qty: number
  kit_cambus_qty: number
  total_items: number
  total_cost: number
  created_at: string
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return 'Erreur serveur.'
}

function toSafeQty(value: unknown, max = 2): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(max, Math.floor(parsed)))
}

function normalizeMemberName(value: unknown): { raw: string; normalized: string } {
  const raw = String(value || '').trim()
  const normalized = raw.toLowerCase()
  return { raw, normalized }
}

function makeInternalId(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24) || 'item'
  return `tablette-${slug}-${Date.now().toString(36).slice(-6)}`
}

async function addToCatalog(groupId: string, name: string, unitPrice: number, qty: number) {
  if (qty <= 0) return

  const supabase = getSupabaseAdmin()
  const { data: existing, error: loadError } = await supabase
    .from('catalog_items')
    .select('id,stock')
    .eq('group_id', groupId)
    .ilike('name', name)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; stock: number | null }>()

  if (loadError) throw loadError

  if (existing?.id) {
    const nextStock = Math.max(0, Number(existing.stock ?? 0) + qty)
    const { error: updateError } = await supabase
      .from('catalog_items')
      .update({ stock: nextStock, updated_at: new Date().toISOString() })
      .eq('group_id', groupId)
      .eq('id', existing.id)
    if (updateError) throw updateError
    return
  }

  const { error: insertError } = await supabase.from('catalog_items').insert({
    group_id: groupId,
    internal_id: makeInternalId(name),
    name,
    category: 'equipment',
    item_type: 'tool',
    description: 'Ajout automatique via Tablette',
    image_url: null,
    buy_price: unitPrice,
    sell_price: unitPrice,
    internal_value: 0,
    show_in_finance: true,
    is_active: true,
    stock: qty,
    low_stock_threshold: 0,
    stackable: true,
    max_stack: 100,
    weight: null,
    fivem_item_id: null,
    hash: null,
    rarity: null,
  })

  if (insertError) throw insertError
}

export async function GET(request: Request) {
  try {
    const session = await requireGroupSession(request)
    const supabase = getSupabaseAdmin()
    const today = toDayKey()

    const { data, error } = await supabase
      .from('tablet_daily_runs')
      .select('id,group_id,member_name,member_name_normalized,day_key,disqueuse_qty,kit_cambus_qty,total_items,total_cost,created_at')
      .eq('group_id', session.groupId)
      .order('created_at', { ascending: false })
      .limit(250)

    if (error) throw error

    return NextResponse.json({
      today,
      items: TABLET_DAILY_ITEM_OPTIONS,
      runs: (data ?? []) as TabletDailyRun[],
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireGroupSession(request)
    const body = (await request.json()) as TabletSubmitPayload
    const member = normalizeMemberName(body.member_name)
    if (!member.raw) return NextResponse.json({ error: 'Nom du membre requis.' }, { status: 400 })

    const disqueuseQty = toSafeQty(body.disqueuse_qty)
    const kitCambriolageQty = toSafeQty(body.kit_cambus_qty)
    const totalItems = disqueuseQty + kitCambriolageQty
    if (totalItems <= 0) {
      return NextResponse.json({ error: 'Ajoute au moins un item (max 2 par item).' }, { status: 400 })
    }

    const disqueusePrice = TABLET_DAILY_ITEM_OPTIONS.find((item) => item.key === 'disqueuse')?.unit_price ?? 150
    const kitCambriolagePrice = TABLET_DAILY_ITEM_OPTIONS.find((item) => item.key === 'kit_cambus')?.unit_price ?? 50
    const totalCost = disqueuseQty * disqueusePrice + kitCambriolageQty * kitCambriolagePrice
    const dayKey = toDayKey()

    const supabase = getSupabaseAdmin()
    const { data: exists } = await supabase
      .from('tablet_daily_runs')
      .select('id')
      .eq('group_id', session.groupId)
      .eq('day_key', dayKey)
      .eq('member_name_normalized', member.normalized)
      .maybeSingle<{ id: string }>()

    if (exists?.id) {
      return NextResponse.json({ error: 'Ce membre a déjà fait la tablette aujourd’hui.' }, { status: 409 })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('tablet_daily_runs')
      .insert({
        group_id: session.groupId,
        member_name: member.raw,
        member_name_normalized: member.normalized,
        day_key: dayKey,
        disqueuse_qty: disqueuseQty,
        kit_cambus_qty: kitCambriolageQty,
        total_items: totalItems,
        total_cost: totalCost,
      })
      .select('id,group_id,member_name,member_name_normalized,day_key,disqueuse_qty,kit_cambus_qty,total_items,total_cost,created_at')
      .single<TabletDailyRunRow>()

    if (insertError) throw insertError

    try {
      await addToCatalog(session.groupId, 'Disqueuse', disqueusePrice, disqueuseQty)
      await addToCatalog(session.groupId, 'Kit de Cambriolage', kitCambriolagePrice, kitCambriolageQty)
    } catch (catalogError: unknown) {
      await supabase.from('tablet_daily_runs').delete().eq('id', inserted.id).eq('group_id', session.groupId)
      throw catalogError
    }

    return NextResponse.json(inserted)
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 400 })
  }
}
