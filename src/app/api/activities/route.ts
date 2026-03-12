import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getSessionFromRequest } from '@/server/auth/session'
import { ACTIVITY_OPTIONS, type ActivityType } from '@/lib/types/activities'

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
        .select('group_id, percent_per_object, weekly_base_salary')
        .eq('group_id', session.groupId)
        .maybeSingle(),
    ])

    if (entriesError) throw entriesError
    if (settingsError) throw settingsError

    const normalizedSettings = {
      group_id: session.groupId,
      percent_per_object: Math.max(0, Number(settings?.percent_per_object) || 2),
      weekly_base_salary: Math.max(0, Number(settings?.weekly_base_salary) || 0),
    }

    const byMember = new Map<string, number>()
    for (const entry of entries ?? []) {
      const name = String(entry.member_name || '').trim()
      if (!name) continue
      byMember.set(name, (byMember.get(name) ?? 0) + Math.max(0, Number(entry.quantity) || 0))
    }

    const summaries = [...byMember.entries()]
      .map(([member_name, total_objects]) => {
        const gain_percent = total_objects * normalizedSettings.percent_per_object
        const estimated_salary = normalizedSettings.weekly_base_salary * (gain_percent / 100)
        return { member_name, total_objects, gain_percent, estimated_salary }
      })
      .sort((a, b) => b.gain_percent - a.gain_percent)

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
      equipment?: string | null
      item_name?: string
      quantity?: number
      proof_image_data?: string
    }

    const memberName = String(body.member_name ?? '').trim()
    const activityType = body.activity_type
    const itemName = String(body.item_name ?? '').trim()
    const quantity = Math.max(0, Math.floor(Number(body.quantity) || 0))
    const proof = String(body.proof_image_data ?? '').trim()
    const equipment = body.equipment ? String(body.equipment).trim() : null

    if (!memberName) return NextResponse.json({ error: 'Nom du membre requis.' }, { status: 400 })
    if (!activityType || !ACTIVITY_OPTIONS.includes(activityType)) return NextResponse.json({ error: 'Activité invalide.' }, { status: 400 })
    if (activityType !== 'Boite au lettre' && !equipment) return NextResponse.json({ error: 'Équipement requis pour cette activité.' }, { status: 400 })
    if (!itemName) return NextResponse.json({ error: 'Objet récupéré requis.' }, { status: 400 })
    if (quantity <= 0) return NextResponse.json({ error: 'Quantité invalide.' }, { status: 400 })
    if (!proof.startsWith('data:image/jpeg;base64,') && !proof.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ error: 'Preuve obligatoire (jpeg/png).' }, { status: 400 })
    }
    if (proof.length > MAX_PROOF_LENGTH) return NextResponse.json({ error: 'Image trop volumineuse.' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('group_activity_entries').insert({
      group_id: session.groupId,
      member_name: memberName,
      activity_type: activityType,
      equipment: activityType === 'Boite au lettre' ? null : equipment,
      item_name: itemName,
      quantity,
      proof_image_data: proof,
    })

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Impossible d\'enregistrer l\'activité.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
