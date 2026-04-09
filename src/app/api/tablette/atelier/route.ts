import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireGroupSession } from '@/server/auth/requireSession'
import { normalizeTabletOptions, TABLET_DAILY_ITEM_OPTIONS, toDayKey } from '@/lib/tabletteItems'
import type { GroupTabletStats, TabletCatalogItemConfig, TabletDailyBudget, TabletDailyRun, TabletRunItemLine, TabletSubmitPayload } from '@/lib/types/tablette'
import { expandAccessPrefixes } from '@/lib/types/groupRoles'

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
  items_json: TabletRunItemLine[] | null
  created_at: string
}

type TabletOptionRow = {
  key: string
  name: string
  unit_price: number | null
  max_per_day: number | null
  image_url: string | null
  sort_order: number | null
}

type GroupAccessRow = {
  active: boolean
  paid_until: string | null
}

class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return 'Erreur serveur.'
}

function toStatusCode(error: unknown) {
  if (error instanceof ApiError) return error.status
  return 400
}

function toSafeQty(value: unknown, max = 2): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(Math.max(0, max), Math.floor(parsed)))
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

async function getGlobalTabletOptions(): Promise<TabletCatalogItemConfig[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tablet_daily_item_options')
    .select('key,name,unit_price,max_per_day,image_url,sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('key', { ascending: true })

  if (error) return TABLET_DAILY_ITEM_OPTIONS

  const options = ((data ?? []) as TabletOptionRow[]).map((row) => ({
    key: row.key,
    name: row.name,
    unit_price: Math.max(0, Number(row.unit_price) || 0),
    max_per_day: Math.max(0, Math.floor(Number(row.max_per_day) || 0)),
    image_url: row.image_url || null,
  }))

  return normalizeTabletOptions(options)
}

async function assertGroupTabletAccess(groupId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tenant_groups')
    .select('active,paid_until')
    .eq('id', groupId)
    .maybeSingle<GroupAccessRow>()

  if (error) throw new ApiError(error.message, 500)
  if (!data || !data.active) throw new ApiError('Accès groupe désactivé.', 403)
  if (data.paid_until && new Date(data.paid_until).getTime() < Date.now()) {
    throw new ApiError('Accès expiré (paiement en retard).', 403)
  }
}

async function addToCatalog(groupId: string, option: TabletCatalogItemConfig, qty: number) {
  if (qty <= 0) return

  const supabase = getSupabaseAdmin()
  const { data: existing, error: loadError } = await supabase
    .from('catalog_items')
    .select('id,stock')
    .eq('group_id', groupId)
    .ilike('name', option.name)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; stock: number | null }>()

  if (loadError) throw loadError

  if (existing?.id) {
    const nextStock = Math.max(0, Number(existing.stock ?? 0) + qty)
    const { error: updateError } = await supabase
      .from('catalog_items')
      .update({ stock: nextStock, updated_at: new Date().toISOString(), image_url: option.image_url || null })
      .eq('group_id', groupId)
      .eq('id', existing.id)
    if (updateError) throw updateError
    return
  }

  const { error: insertError } = await supabase.from('catalog_items').insert({
    group_id: groupId,
    internal_id: makeInternalId(option.name),
    name: option.name,
    category: 'equipment',
    item_type: 'tool',
    description: 'Ajout automatique via Tablette',
    image_url: option.image_url || null,
    buy_price: option.unit_price,
    sell_price: option.unit_price,
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

async function adjustCashStock(groupId: string, delta: number) {
  if (delta === 0) return
  const supabase = getSupabaseAdmin()
  const { data: cashItem, error: cashLoadError } = await supabase
    .from('catalog_items')
    .select('id,stock,name')
    .eq('group_id', groupId)
    .ilike('name', 'argent')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; stock: number | null; name: string }>()

  if (cashLoadError) throw cashLoadError
  if (!cashItem?.id) throw new ApiError('Item "argent" introuvable dans le catalogue.', 400)

  const currentStock = Math.max(0, Number(cashItem.stock || 0))
  const nextStock = Math.max(0, currentStock + delta)
  if (delta < 0 && currentStock < Math.abs(delta)) {
    throw new ApiError(`Stock insuffisant sur "${cashItem.name}" (requis: ${Math.abs(delta)}).`, 400)
  }

  const { error: updateCashError } = await supabase
    .from('catalog_items')
    .update({ stock: nextStock, updated_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('id', cashItem.id)

  if (updateCashError) throw updateCashError
}

function buildGroupStats(runs: TabletDailyRun[]): GroupTabletStats {
  const today = toDayKey()
  const weekPrefix = today.slice(0, 8)

  const todayRuns = runs.filter((run) => run.day_key === today)
  const weekRuns = runs.filter((run) => run.day_key.startsWith(weekPrefix))

  const memberMap = new Map<string, { total_runs: number; total_items: number; total_cost: number; did_today: boolean; last_day_key: string }>()
  for (const run of runs) {
    const key = run.member_name.trim().toLowerCase()
    const entry = memberMap.get(key) ?? { total_runs: 0, total_items: 0, total_cost: 0, did_today: false, last_day_key: run.day_key }
    entry.total_runs += 1
    entry.total_items += Math.max(0, Number(run.total_items) || 0)
    entry.total_cost += Math.max(0, Number(run.total_cost) || 0)
    entry.did_today = entry.did_today || run.day_key === today
    if (run.day_key > entry.last_day_key) entry.last_day_key = run.day_key
    memberMap.set(key, entry)
  }

  return {
    today: {
      runs: todayRuns.length,
      items: todayRuns.reduce((sum, run) => sum + Math.max(0, Number(run.total_items) || 0), 0),
      cost: Number(todayRuns.reduce((sum, run) => sum + Math.max(0, Number(run.total_cost) || 0), 0).toFixed(2)),
      unique_members: new Set(todayRuns.map((run) => run.member_name.trim().toLowerCase())).size,
    },
    week: {
      runs: weekRuns.length,
      items: weekRuns.reduce((sum, run) => sum + Math.max(0, Number(run.total_items) || 0), 0),
      cost: Number(weekRuns.reduce((sum, run) => sum + Math.max(0, Number(run.total_cost) || 0), 0).toFixed(2)),
      unique_members: new Set(weekRuns.map((run) => run.member_name.trim().toLowerCase())).size,
    },
    members: [...memberMap.entries()]
      .map(([member_name, value]) => ({
        member_name,
        total_runs: value.total_runs,
        total_items: value.total_items,
        total_cost: Number(value.total_cost.toFixed(2)),
        did_today: value.did_today,
        last_day_key: value.last_day_key,
      }))
      .sort((a, b) => b.total_runs - a.total_runs),
  }
}

type StoredBudget = {
  day_key: string
  budget_initial: number
  payout_per_run: number
  paid_runs: number
  distributed_total: number
  paid_members: string[]
}

function parseBudgetOrder(dayKey: string, order: string[] | null | undefined): StoredBudget | null {
  if (!Array.isArray(order) || order.length === 0) return null
  const map = new Map(order.map((entry) => {
    const [key, ...rest] = String(entry).split(':')
    return [key.trim(), rest.join(':').trim()]
  }))
  const budgetInitial = Number(map.get('budget_initial') || 0)
  const payoutPerRun = Number(map.get('payout_per_run') || 0)
  const paidRuns = Number(map.get('paid_runs') || 0)
  const distributedTotal = Number(map.get('distributed_total') || 0)
  const paidMembers = String(map.get('paid_members') || '')
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean)
  if (!Number.isFinite(budgetInitial) || !Number.isFinite(payoutPerRun)) return null
  return {
    day_key: dayKey,
    budget_initial: Math.max(0, budgetInitial),
    payout_per_run: Math.max(0, payoutPerRun),
    paid_runs: Math.max(0, Math.floor(paidRuns || 0)),
    distributed_total: Math.max(0, distributedTotal),
    paid_members: paidMembers,
  }
}

function serializeBudgetOrder(budget: StoredBudget) {
  return [
    `budget_initial:${budget.budget_initial}`,
    `payout_per_run:${budget.payout_per_run}`,
    `paid_runs:${budget.paid_runs}`,
    `distributed_total:${budget.distributed_total}`,
    `paid_members:${budget.paid_members.join('|')}`,
  ]
}

async function loadTodayBudget(groupId: string, dayKey: string): Promise<StoredBudget | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('ui_layouts')
    .select('order')
    .eq('scope_type', 'group')
    .eq('scope_id', groupId)
    .eq('page_key', `tablette.coffre.${dayKey}`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ order: string[] | null }>()
  if (error) throw error
  return parseBudgetOrder(dayKey, data?.order)
}

async function saveTodayBudget(groupId: string, budget: StoredBudget) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('ui_layouts')
    .upsert({
      scope_type: 'group',
      scope_id: groupId,
      page_key: `tablette.coffre.${budget.day_key}`,
      order: serializeBudgetOrder(budget),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'scope_type,scope_id,page_key' })
  if (error) throw error
}

function toPublicBudget(dayKey: string, budget: StoredBudget | null): TabletDailyBudget | null {
  if (!budget) return null
  const distributed = Math.max(0, Number(budget.distributed_total || 0))
  const remaining = Math.max(0, Number(budget.budget_initial || 0) - distributed)
  return {
    day_key: dayKey,
    budget_initial: Math.max(0, Number(budget.budget_initial || 0)),
    payout_per_run: Math.max(0, Number(budget.payout_per_run || 0)),
    paid_runs: Math.max(0, Number(budget.paid_runs || 0)),
    distributed_total: distributed,
    remaining,
    paid_members: budget.paid_members,
  }
}

function canManageTabletBudget(session: { isAdmin?: boolean; allowedPrefixes?: string[] }) {
  if (session.isAdmin) return true
  const allowed = expandAccessPrefixes(Array.isArray(session.allowedPrefixes) ? session.allowedPrefixes : [])
  return allowed.includes('/') || allowed.includes('/tablette/coffre')
}

export async function GET(request: Request) {
  try {
    const session = await requireGroupSession(request)
    await assertGroupTabletAccess(session.groupId)
    const supabase = getSupabaseAdmin()
    const today = toDayKey()

    const { data, error } = await supabase
      .from('tablet_daily_runs')
      .select('id,group_id,member_name,member_name_normalized,day_key,disqueuse_qty,kit_cambus_qty,total_items,total_cost,items_json,created_at')
      .eq('group_id', session.groupId)
      .order('created_at', { ascending: false })
      .limit(250)

    if (error) throw error

    const runs = (data ?? []) as TabletDailyRun[]

    let budget = canManageTabletBudget(session) ? await loadTodayBudget(session.groupId, today) : null
    if (budget) {
      const todayRuns = runs.filter((run) => run.day_key === today)
      const distributedFromRuns = Number(todayRuns.reduce((sum, run) => sum + Math.max(0, Number(run.total_cost || 0)), 0).toFixed(2))
      if (budget.distributed_total !== distributedFromRuns || budget.paid_runs !== todayRuns.length) {
        budget = { ...budget, distributed_total: distributedFromRuns, paid_runs: todayRuns.length }
        await saveTodayBudget(session.groupId, budget)
      }
    }
    return NextResponse.json({
      today,
      items: await getGlobalTabletOptions(),
      runs,
      stats: buildGroupStats(runs),
      budget: toPublicBudget(today, budget),
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: toStatusCode(error) })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireGroupSession(request)
    await assertGroupTabletAccess(session.groupId)
    const body = (await request.json()) as TabletSubmitPayload & {
      budget_initial?: number
      payout_per_run?: number
      action?: 'run' | 'init_budget' | 'update_budget' | 'reset_budget'
    }
    const options = await getGlobalTabletOptions()
    const dayKey = toDayKey()
    if (body.action === 'init_budget' || body.action === 'update_budget') {
      if (!canManageTabletBudget(session)) {
        return NextResponse.json({ error: 'Action non autorisée.' }, { status: 403 })
      }
      const budgetInitial = Math.max(0, Number(body.budget_initial || 0))
      const existing = await loadTodayBudget(session.groupId, dayKey)
      const nextBudget: StoredBudget = {
        day_key: dayKey,
        budget_initial: budgetInitial,
        payout_per_run: 0,
        paid_runs: existing?.paid_runs ?? 0,
        distributed_total: existing?.distributed_total ?? 0,
        paid_members: existing?.paid_members ?? [],
      }
      await saveTodayBudget(session.groupId, nextBudget)
      return NextResponse.json({ ok: true, budget: toPublicBudget(dayKey, nextBudget) })
    }
    if (body.action === 'reset_budget') {
      if (!canManageTabletBudget(session)) {
        return NextResponse.json({ error: 'Action non autorisée.' }, { status: 403 })
      }
      const resetBudget: StoredBudget = {
        day_key: dayKey,
        budget_initial: 0,
        payout_per_run: 0,
        paid_runs: 0,
        distributed_total: 0,
        paid_members: [],
      }
      await saveTodayBudget(session.groupId, resetBudget)
      return NextResponse.json({ ok: true, budget: toPublicBudget(dayKey, resetBudget) })
    }

    const member = normalizeMemberName(body.member_name)
    if (!member.raw) return NextResponse.json({ error: 'Nom du membre requis.' }, { status: 400 })

    const quantities = body.quantities || {}

    const lines: TabletRunItemLine[] = options
      .map((option) => {
        const qty = toSafeQty(quantities[option.key], option.max_per_day)
        return {
          key: option.key,
          name: option.name,
          quantity: qty,
          unit_price: option.unit_price,
          subtotal: Number((qty * option.unit_price).toFixed(2)),
        }
      })
      .filter((line) => line.quantity > 0)

    const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0)
    if (totalItems <= 0) {
      return NextResponse.json({ error: 'Ajoute au moins un item.' }, { status: 400 })
    }

    const totalCost = Number(lines.reduce((sum, line) => sum + line.subtotal, 0).toFixed(2))
    const budget = await loadTodayBudget(session.groupId, dayKey)
    const remainingBefore = Math.max(0, Number(budget?.budget_initial || 0) - Math.max(0, Number(budget?.distributed_total || 0)))
    if (budget && remainingBefore < totalCost) {
      return NextResponse.json({ error: 'Budget tablette insuffisant.' }, { status: 400 })
    }

    const legacyDisqueuseQty = lines.find((line) => line.key === 'disqueuse')?.quantity ?? 0
    const legacyKitQty = lines.find((line) => line.key === 'kit_cambus')?.quantity ?? 0

    const supabase = getSupabaseAdmin()
    const { data: exists } = await supabase
      .from('tablet_daily_runs')
      .select('id')
      .eq('group_id', session.groupId)
      .eq('day_key', dayKey)
      .eq('member_name_normalized', member.normalized)
      .limit(1)
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
        disqueuse_qty: legacyDisqueuseQty,
        kit_cambus_qty: legacyKitQty,
        total_items: totalItems,
        total_cost: totalCost,
        items_json: lines,
      })
      .select('id,group_id,member_name,member_name_normalized,day_key,disqueuse_qty,kit_cambus_qty,total_items,total_cost,items_json,created_at')
      .single<TabletDailyRunRow>()

    if (insertError) throw insertError

    try {
      await adjustCashStock(session.groupId, -totalCost)
      for (const line of lines) {
        const option = options.find((item) => item.key === line.key)
        if (!option) continue
        await addToCatalog(session.groupId, option, line.quantity)
      }
    } catch (catalogError: unknown) {
      await supabase.from('tablet_daily_runs').delete().eq('id', inserted.id).eq('group_id', session.groupId)
      try {
        await adjustCashStock(session.groupId, totalCost)
      } catch {
        // noop: preserve original error path
      }
      throw catalogError
    }

    if (budget) {
      const nextBudget: StoredBudget = {
        ...budget,
        paid_runs: budget.paid_runs + 1,
        distributed_total: Number((budget.distributed_total + totalCost).toFixed(2)),
        paid_members: budget.paid_members,
      }
      await saveTodayBudget(session.groupId, nextBudget)
    }

    return NextResponse.json(inserted)
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: toStatusCode(error) })
  }
}
