import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getSessionFromRequest } from '@/server/auth/session'

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.groupId) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
    if (session.role === 'member') return NextResponse.json({ error: 'Accès réservé au chef.' }, { status: 403 })

    const body = (await request.json()) as { percent_per_object?: number; weekly_base_salary?: number }
    const percent = Math.max(0, Number(body.percent_per_object) || 0)
    const weeklySalary = Math.max(0, Number(body.weekly_base_salary) || 0)

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('group_activity_settings')
      .upsert({
        group_id: session.groupId,
        percent_per_object: percent,
        weekly_base_salary: weeklySalary,
      }, { onConflict: 'group_id' })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Impossible de sauvegarder les paramètres.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
