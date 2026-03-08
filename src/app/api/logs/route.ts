import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireSession } from '@/server/auth/requireSession'
import type { AppLogEntry, CreateAppLogInput } from '@/lib/types/logs'

function toSafeLimit(raw: string | null, fallback: number) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(1000, Math.max(1, Math.floor(n)))
}

export async function GET(request: Request) {
  try {
    const session = await requireSession(request)
    const limit = toSafeLimit(new URL(request.url).searchParams.get('limit'), 250)
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('app_logs')
      .select('*')
      .eq('group_id', session.groupId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return NextResponse.json((data ?? []) as AppLogEntry[])
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossible de charger les logs.' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(request)
    const body = (await request.json()) as CreateAppLogInput
    if (!body?.area?.trim() || !body?.action?.trim() || !body?.message?.trim()) {
      return NextResponse.json({ error: 'area/action/message sont requis.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const payload = {
      group_id: session.groupId,
      group_name: session.groupName,
      actor_name: body.actor_name?.trim() || session.groupName,
      actor_source: body.actor_source || 'web',
      area: body.area.trim(),
      action: body.action.trim(),
      entity_type: body.entity_type?.trim() || null,
      entity_id: body.entity_id?.trim() || null,
      message: body.message.trim(),
      payload: body.payload || null,
    }

    const { error } = await supabase.from('app_logs').insert(payload)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossible d\'écrire le log.' }, { status: 400 })
  }
}
