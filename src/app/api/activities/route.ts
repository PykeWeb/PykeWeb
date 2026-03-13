import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getSessionFromRequest } from '@/server/auth/session'
import {
  ACTIVITY_OPTIONS,
  type ActivityEquipmentLineInput,
  type ActivityObjectLineInput,
  type ActivityType,
} from '@/lib/types/activities'

type CatalogItemRow = { id: string; name: string; category: string; buy_price: number | null }

const MAX_PROOF_LENGTH = 3_000_000

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

function toWeekStart(date = new Date()) {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setHours(0, 0, 0, 0)
  copy.setDate(copy.getDate() + diff)
  return copy
}

function toWeekEnd(weekStart: Date) {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 7)
  return end
}

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.groupId) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })

    const url = new URL(request.url)
    const rawWeekStart = url.searchParams.get('weekStart')
    const weekStart = rawWeekStart ? new Date(rawWeekStart) : toWeekStart()
    if (Number.isNaN(weekStart.getTime())) return NextResponse.json({ error: 'Semaine invalide.' }, { status: 400 })
    const weekEnd = toWeekEnd(weekStart)

    const supabase = getSupabaseAdmin()
    const [{ data: entries, error: entriesError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase
        .from('group_activity_entries')
        .select('*')
        .eq('group_id', session.groupId)
        .gte('created_at', weekStart.toISOString())
        .lt('created_at', weekEnd.toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('group_activity_settings')
        .select('group_id, default_percent_per_object')
        .eq('group_id', session.groupId)
        .maybeSingle(),
    ])

    if (entriesError) throw entriesError
    if (settingsError) throw settingsError

    const normalizedSettings = {
      group_id: session.groupId,
      default_percent_per_object: Math.max(0, Number(settings?.default_percent_per_object) || 2),
    }

    const byMember = new Map<string, { totalObjects: number; totalSalary: number }>()
    for (const entry of entries ?? []) {
      const name = String(entry.member_name || '').trim()
      if (!name) continue
      const prev = byMember.get(name) ?? { totalObjects: 0, totalSalary: 0 }
      byMember.set(name, {
        totalObjects: prev.totalObjects + Math.max(0, Number(entry.quantity) || 0),
        totalSalary: prev.totalSalary + Math.max(0, Number(entry.salary_amount) || 0),
      })
    }

    const summaries = [...byMember.entries()]
      .map(([member_name, stats]) => ({ member_name, total_objects: stats.totalObjects, total_salary: stats.totalSalary }))
      .sort((a, b) => b.total_salary - a.total_salary)

    return NextResponse.json({ entries: entries ?? [], summaries, settings: normalizedSettings })
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error, 'Impossible de charger les activités.') }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.groupId) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })

    const body = (await request.json()) as {
      member_name?: string
      activity_type?: ActivityType
      object_lines?: ActivityObjectLineInput[]
      equipment_lines?: ActivityEquipmentLineInput[]
      percent_per_object?: number
      proof_image_data?: string
    }

    const memberName = String(body.member_name ?? '').trim()
    const activityType = body.activity_type
    const objectLines = Array.isArray(body.object_lines) ? body.object_lines : []
    const equipmentLines = Array.isArray(body.equipment_lines) ? body.equipment_lines : []
    const proof = String(body.proof_image_data ?? '').trim()

    if (!memberName) return NextResponse.json({ error: 'Nom du membre requis.' }, { status: 400 })
    if (!activityType || !ACTIVITY_OPTIONS.includes(activityType)) return NextResponse.json({ error: 'Activité invalide.' }, { status: 400 })
    if (objectLines.length === 0) return NextResponse.json({ error: 'Ajoute au moins un objet.' }, { status: 400 })
    if (objectLines.some((line) => !line.object_item_id || Math.max(0, Math.floor(Number(line.quantity) || 0)) <= 0)) {
      return NextResponse.json({ error: 'Lignes objets invalides.' }, { status: 400 })
    }
    if (activityType !== 'Boite au lettre') {
      if (equipmentLines.length === 0) return NextResponse.json({ error: 'Ajoute au moins un équipement.' }, { status: 400 })
      if (equipmentLines.some((line) => !line.equipment_item_id || Math.max(0, Math.floor(Number(line.quantity) || 0)) <= 0)) {
        return NextResponse.json({ error: 'Lignes équipements invalides.' }, { status: 400 })
      }
    }
    if (!proof.startsWith('data:image/jpeg;base64,') && !proof.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ error: 'Preuve obligatoire (jpeg/png).' }, { status: 400 })
    }
    if (proof.length > MAX_PROOF_LENGTH) return NextResponse.json({ error: 'Image trop volumineuse.' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data: settings, error: settingsError } = await supabase
      .from('group_activity_settings')
      .select('default_percent_per_object')
      .eq('group_id', session.groupId)
      .maybeSingle()

    if (settingsError) throw settingsError

    const fallbackPercent = Math.max(0.01, Number(settings?.default_percent_per_object) || 2)
    const canOverridePercent = Boolean(session.isAdmin || session.role === 'chef')
    const requestedPercent = Math.max(0.01, Number(body.percent_per_object) || 0.01)
    const percent = canOverridePercent ? requestedPercent : fallbackPercent

    if (percent <= 0) return NextResponse.json({ error: 'Pourcentage invalide.' }, { status: 400 })

    const objectIds = [...new Set(objectLines.map((line) => String(line.object_item_id).trim()).filter(Boolean))]
    const { data: objectRows, error: objectErr } = await supabase
      .from('catalog_items')
      .select('id,name,category,buy_price')
      .eq('group_id', session.groupId)
      .eq('is_active', true)
      .in('id', objectIds)

    if (objectErr) throw objectErr
    const objectMap = new Map<string, CatalogItemRow>()
    for (const row of (objectRows ?? []) as CatalogItemRow[]) {
      if (row.category === 'objects') objectMap.set(row.id, row)
    }
    if (objectMap.size !== objectIds.length) return NextResponse.json({ error: 'Un ou plusieurs objets sont invalides.' }, { status: 400 })

    let equipmentDisplay = ''
    let equipmentTotalQty = 0
    let firstEquipmentId: string | null = null

    if (activityType !== 'Boite au lettre') {
      const equipmentIds = [...new Set(equipmentLines.map((line) => String(line.equipment_item_id).trim()).filter(Boolean))]
      const { data: equipmentRows, error: equipmentErr } = await supabase
        .from('catalog_items')
        .select('id,name,category,buy_price')
        .eq('group_id', session.groupId)
        .eq('is_active', true)
        .in('id', equipmentIds)

      if (equipmentErr) throw equipmentErr
      const equipmentMap = new Map<string, CatalogItemRow>()
      for (const row of (equipmentRows ?? []) as CatalogItemRow[]) {
        if (row.category === 'equipment') equipmentMap.set(row.id, row)
      }
      if (equipmentMap.size !== equipmentIds.length) return NextResponse.json({ error: 'Un ou plusieurs équipements sont invalides.' }, { status: 400 })

      const parts: string[] = []
      for (const line of equipmentLines) {
        const item = equipmentMap.get(line.equipment_item_id)
        if (!item) continue
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1))
        equipmentTotalQty += qty
        parts.push(`${item.name} x${qty}`)
        if (!firstEquipmentId) firstEquipmentId = item.id
      }
      equipmentDisplay = parts.join(' • ')
    }

    const rowsToInsert = objectLines.map((line) => {
      const item = objectMap.get(line.object_item_id) as CatalogItemRow
      const qty = Math.max(1, Math.floor(Number(line.quantity) || 1))
      const objectPrice = Math.max(0, Number(item.buy_price) || 0)
      const salaryAmount = objectPrice * qty * (percent / 100)

      return {
        group_id: session.groupId,
        member_name: memberName,
        activity_type: activityType,
        object_item_id: item.id,
        object_name: item.name,
        object_unit_price: objectPrice,
        quantity: qty,
        percent_per_object: percent,
        salary_amount: salaryAmount,
        equipment_item_id: firstEquipmentId,
        equipment_name: equipmentDisplay || null,
        equipment_quantity: activityType === 'Boite au lettre' ? 0 : equipmentTotalQty,
        proof_image_data: proof,
      }
    })

    const { error } = await supabase.from('group_activity_entries').insert(rowsToInsert)
    if (error) throw error

    return NextResponse.json({ ok: true, inserted: rowsToInsert.length })
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error, "Impossible d'enregistrer l'activité.") }, { status: 400 })
  }
}
