import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { readTenantServerSession } from '@/lib/server/tenantServerSession'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const session = await readTenantServerSession()
    const groupId = session?.groupId && session.groupId !== 'admin' ? session.groupId : null

    const { data: globalRows, error: gErr } = await supabase
      .from('ui_texts')
      .select('key,value')
      .eq('scope', 'global')

    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

    let merged: Record<string, string> = Object.fromEntries((globalRows ?? []).map((r: any) => [r.key, r.value]))

    if (groupId) {
      const { data: groupRows } = await supabase
        .from('ui_texts')
        .select('key,value')
        .eq('scope', 'group')
        .eq('group_id', groupId)
      merged = { ...merged, ...Object.fromEntries((groupRows ?? []).map((r: any) => [r.key, r.value])) }
    }

    return NextResponse.json({ overrides: merged })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}
