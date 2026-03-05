import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getSessionFromRequest } from '@/server/auth/session'

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin()
    const session = await getSessionFromRequest(request)
    const groupId = session?.groupId && session.groupId !== 'admin' ? session.groupId : null

    const { data: globalRows, error: gErr } = await supabase
      .from('ui_texts')
      .select('key,value')
      .eq('scope', 'global')

    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

    let merged: Record<string, string> = Object.fromEntries((globalRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))

    if (groupId) {
      const { data: groupRows } = await supabase
        .from('ui_texts')
        .select('key,value')
        .eq('scope', 'group')
        .eq('group_id', groupId)
      merged = { ...merged, ...Object.fromEntries((groupRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value])) }
    }

    return NextResponse.json({ overrides: merged })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}
