import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getSessionFromRequest } from '@/server/auth/session'
import { ACTIVITY_OPTIONS, type ActivityType } from '@/lib/types/activities'

type CatalogItemRow = { id: string; name: string; category: string; buy_price: number | null }

const MAX_PROOF_LENGTH = 3_000_000

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
    const message = error instanceof Error ? error.message : 'Impossible de charger les activités.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.groupId) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })

    const body = (await request.json()) as {
      member_name?: string
      activity_type?: ActivityType
      object_item_id?: string
      quantity?: number
      equipment_item_id?: string | null
      equipment_quantity?: number
      percent_per_object?: number
      proof_image_data?: string
    }

    const memberName = String(body.member_name ?? '').trim()
    const activityType = body.activity_type
    const objectItemId = String(body.object_item_id ?? '').trim()
    const quantity = Math.max(0, Math.floor(Number(body.quantity) || 0))
    const equipmentItemId = body.equipment_item_id ? String(body.equipment_item_id).trim() : null
    const equipmentQuantity = Math.max(0, Math.floor(Number(body.equipment_quantity) || 0))
    const percent = Math.max(0, Number(body.percent_per_object) || 0)
    const proof = String(body.proof_image_data ?? '').trim()

    if (!memberName) return NextResponse.json({ error: 'Nom du membre requis.' }, { status: 400 })
    if (!activityType || !ACTIVITY_OPTIONS.includes(activityType)) return NextResponse.json({ error: 'Activité invalide.' }, { status: 400 })
    if (!objectItemId) return NextResponse.json({ error: 'Objet requis.' }, { status: 400 })
    if (quantity <= 0) return NextResponse.json({ error: 'Quantité objet invalide.' }, { status: 400 })
    if (activityType !== 'Boite au lettre') {
      if (!equipmentItemId) return NextResponse.json({ error: 'Équipement requis pour cette activité.' }, { status: 400 })
      if (equipmentQuantity <= 0) return NextResponse.json({ error: 'Quantité équipement invalide.' }, { status: 400 })
    }
    if (percent <= 0) return NextResponse.json({ error: 'Pourcentage invalide.' }, { status: 400 })
    if (!proof.startsWith('data:image/jpeg;base64,') && !proof.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ error: 'Preuve obligatoire (jpeg/png).' }, { status: 400 })
    }
    if (proof.length > MAX_PROOF_LENGTH) return NextResponse.json({ error: 'Image trop volumineuse.' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data: objectItem, error: objectError } = await supabase
      .from('catalog_items')
      .select('id,name,category,buy_price')
      .eq('group_id', session.groupId)
      .eq('id', objectItemId)
      .eq('is_active', true)
      .maybeSingle<CatalogItemRow>()
    if (objectError) throw objectError
    if (!objectItem || objectItem.category !== 'objects') {
      return NextResponse.json({ error: 'Objet invalide (catégorie Objets requise).' }, { status: 400 })
    }

    let equipmentItem: CatalogItemRow | null = null
    if (activityType !== 'Boite au lettre') {
      const { data, error } = await supabase
        .from('catalog_items')
        .select('id,name,category,buy_price')
        .eq('group_id', session.groupId)
        .eq('id', equipmentItemId)
        .eq('is_active', true)
        .maybeSingle<CatalogItemRow>()
      if (error) throw error
      if (!data || data.category !== 'equipment') {
        return NextResponse.json({ error: 'Équipement invalide (catégorie Équipement requise).' }, { status: 400 })
      }
      equipmentItem = data
    }

    const objectPrice = Math.max(0, Number(objectItem.buy_price) || 0)
    const salaryAmount = objectPrice * quantity * (percent / 100)

    const { error } = await supabase.from('group_activity_entries').insert({
      group_id: session.groupId,
      member_name: memberName,
      activity_type: activityType,
      object_item_id: objectItem.id,
      object_name: objectItem.name,
      object_unit_price: objectPrice,
      quantity,
      percent_per_object: percent,
      salary_amount: salaryAmount,
      equipment_item_id: equipmentItem?.id ?? null,
      equipment_name: equipmentItem?.name ?? null,
      equipment_quantity: activityType === 'Boite au lettre' ? 0 : equipmentQuantity,
      proof_image_data: proof,
    })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Impossible d\'enregistrer l\'activité.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
