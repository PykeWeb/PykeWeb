import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertAdminSession } from '@/server/auth/admin'
import { toDayKey } from '@/lib/tabletteItems'
import type {
  AdminTabletAtelierStatsResponse,
  TabletDailyAggregate,
  TabletGroupTodayStatus,
  TabletMemberAggregate,
  TabletRunItemLine,
  TabletWeeklyAggregate,
} from '@/lib/types/tablette'

type TabletDailyRunRow = {
  group_id: string
  day_key: string
  member_name: string
  total_items: number
  total_cost: number
  disqueuse_qty: number
  kit_cambus_qty: number
  items_json: TabletRunItemLine[] | null
}

type TenantGroupRow = {
  id: string
  name: string
}

function getWeekKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map((value) => Number(value))
  if (!y || !m || !d) return dayKey
  const date = new Date(Date.UTC(y, m - 1, d))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function extractRunLines(row: TabletDailyRunRow): TabletRunItemLine[] {
  if (Array.isArray(row.items_json) && row.items_json.length > 0) {
    return row.items_json
      .map((line) => ({
        key: String(line.key || '').trim(),
        name: String(line.name || '').trim(),
        quantity: Math.max(0, Number(line.quantity) || 0),
        unit_price: Math.max(0, Number(line.unit_price) || 0),
        subtotal: Math.max(0, Number(line.subtotal) || 0),
      }))
      .filter((line) => line.name.length > 0 && line.quantity > 0)
  }

  const legacy: TabletRunItemLine[] = []
  if ((row.disqueuse_qty ?? 0) > 0) {
    legacy.push({ key: 'disqueuse', name: 'Disqueuse', quantity: Math.max(0, Number(row.disqueuse_qty) || 0), unit_price: 0, subtotal: 0 })
  }
  if ((row.kit_cambus_qty ?? 0) > 0) {
    legacy.push({ key: 'kit_cambus', name: 'Kit de Cambriolage', quantity: Math.max(0, Number(row.kit_cambus_qty) || 0), unit_price: 0, subtotal: 0 })
  }
  return legacy
}

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase()
}

export async function GET(request: Request) {
  try {
    await assertAdminSession(request)
    const supabase = getSupabaseAdmin()
    const today = toDayKey()

    const [{ data: runs, error: runsError }, { data: groups, error: groupsError }] = await Promise.all([
      supabase
        .from('tablet_daily_runs')
        .select('group_id,day_key,member_name,total_items,total_cost,disqueuse_qty,kit_cambus_qty,items_json')
        .order('day_key', { ascending: false })
        .limit(5000),
      supabase.from('tenant_groups').select('id,name').eq('active', true),
    ])

    if (runsError) throw runsError
    if (groupsError) throw groupsError

    const rows = (runs ?? []) as TabletDailyRunRow[]

    const byDayMap = new Map<string, { runs: number; total_items: number; total_cost: number; members: Set<string> }>()
    const byWeekMap = new Map<string, { runs: number; total_items: number; total_cost: number; members: Set<string> }>()
    const byMemberMap = new Map<string, { total_runs: number; total_items: number; total_cost: number; last_day_key: string; did_today: boolean }>()
    const byGroupTodayMap = new Map<string, { runs_today: number; items_today: number; members: Set<string> }>()
    const byDayItemsMap = new Map<string, Map<string, { name: string; quantity: number }>>()
    const byWeekItemsMap = new Map<string, Map<string, { name: string; quantity: number }>>()

    for (const row of rows) {
      const dayBucket = byDayMap.get(row.day_key) ?? { runs: 0, total_items: 0, total_cost: 0, members: new Set<string>() }
      dayBucket.runs += 1
      dayBucket.total_items += Math.max(0, Number(row.total_items) || 0)
      dayBucket.total_cost += Math.max(0, Number(row.total_cost) || 0)
      dayBucket.members.add(row.member_name.trim().toLowerCase())
      byDayMap.set(row.day_key, dayBucket)

      const weekKey = getWeekKey(row.day_key)
      const weekBucket = byWeekMap.get(weekKey) ?? { runs: 0, total_items: 0, total_cost: 0, members: new Set<string>() }
      weekBucket.runs += 1
      weekBucket.total_items += Math.max(0, Number(row.total_items) || 0)
      weekBucket.total_cost += Math.max(0, Number(row.total_cost) || 0)
      weekBucket.members.add(row.member_name.trim().toLowerCase())
      byWeekMap.set(weekKey, weekBucket)

      const normalizedMember = row.member_name.trim().toLowerCase()
      const memberBucket = byMemberMap.get(normalizedMember) ?? {
        total_runs: 0,
        total_items: 0,
        total_cost: 0,
        last_day_key: row.day_key,
        did_today: false,
      }
      memberBucket.total_runs += 1
      memberBucket.total_items += Math.max(0, Number(row.total_items) || 0)
      memberBucket.total_cost += Math.max(0, Number(row.total_cost) || 0)
      if (row.day_key > memberBucket.last_day_key) memberBucket.last_day_key = row.day_key
      if (row.day_key === today) memberBucket.did_today = true
      byMemberMap.set(normalizedMember, memberBucket)

      if (row.day_key === today) {
        const groupBucket = byGroupTodayMap.get(row.group_id) ?? { runs_today: 0, items_today: 0, members: new Set<string>() }
        groupBucket.runs_today += 1
        groupBucket.items_today += Math.max(0, Number(row.total_items) || 0)
        groupBucket.members.add(row.member_name.trim().toLowerCase())
        byGroupTodayMap.set(row.group_id, groupBucket)
      }

      const dayItems = byDayItemsMap.get(row.day_key) ?? new Map<string, { name: string; quantity: number }>()
      const weekItems = byWeekItemsMap.get(weekKey) ?? new Map<string, { name: string; quantity: number }>()
      for (const line of extractRunLines(row)) {
        const key = normalizeItemName(line.name)
        const dayEntry = dayItems.get(key) ?? { name: line.name, quantity: 0 }
        dayEntry.quantity += line.quantity
        dayItems.set(key, dayEntry)

        const weekEntry = weekItems.get(key) ?? { name: line.name, quantity: 0 }
        weekEntry.quantity += line.quantity
        weekItems.set(key, weekEntry)
      }
      byDayItemsMap.set(row.day_key, dayItems)
      byWeekItemsMap.set(weekKey, weekItems)
    }

    const todayTotals = byDayMap.get(today)
    const weekTotals = byWeekMap.get(getWeekKey(today))

    const by_day: TabletDailyAggregate[] = [...byDayMap.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 14)
      .map(([day_key, value]) => ({
        day_key,
        runs: value.runs,
        total_items: value.total_items,
        total_cost: Number(value.total_cost.toFixed(2)),
        unique_members: value.members.size,
      }))

    const by_week: TabletWeeklyAggregate[] = [...byWeekMap.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 8)
      .map(([week_key, value]) => ({
        week_key,
        runs: value.runs,
        total_items: value.total_items,
        total_cost: Number(value.total_cost.toFixed(2)),
        unique_members: value.members.size,
      }))

    const by_day_items = [...byDayItemsMap.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 14)
      .map(([day_key, itemsMap]) => ({
        day_key,
        items: [...itemsMap.values()].sort((a, b) => b.quantity - a.quantity),
      }))

    const by_week_items = [...byWeekItemsMap.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 8)
      .map(([week_key, itemsMap]) => ({
        week_key,
        items: [...itemsMap.values()].sort((a, b) => b.quantity - a.quantity),
      }))

    const by_member: TabletMemberAggregate[] = [...byMemberMap.entries()]
      .map(([member_name, value]) => ({
        member_name,
        total_runs: value.total_runs,
        total_items: value.total_items,
        total_cost: Number(value.total_cost.toFixed(2)),
        last_day_key: value.last_day_key,
        did_today: value.did_today,
      }))
      .sort((a, b) => b.total_runs - a.total_runs)

    const groupRows = (groups ?? []) as TenantGroupRow[]
    const by_group_today: TabletGroupTodayStatus[] = groupRows
      .map((group) => {
        const bucket = byGroupTodayMap.get(group.id)
        return {
          group_id: group.id,
          group_name: group.name,
          runs_today: bucket?.runs_today ?? 0,
          items_today: bucket?.items_today ?? 0,
          unique_members_today: bucket?.members.size ?? 0,
        }
      })
      .sort((a, b) => b.runs_today - a.runs_today)

    const payload: AdminTabletAtelierStatsResponse = {
      today,
      totals: {
        runs_today: todayTotals?.runs ?? 0,
        items_today: todayTotals?.total_items ?? 0,
        cost_today: Number((todayTotals?.total_cost ?? 0).toFixed(2)),
        runs_week: weekTotals?.runs ?? 0,
        items_week: weekTotals?.total_items ?? 0,
        cost_week: Number((weekTotals?.total_cost ?? 0).toFixed(2)),
      },
      by_day,
      by_week,
      by_day_items,
      by_week_items,
      by_member,
      by_group_today,
    }

    return NextResponse.json(payload)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    await assertAdminSession(request)
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('tablet_daily_runs').delete().not('id', 'is', null)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
