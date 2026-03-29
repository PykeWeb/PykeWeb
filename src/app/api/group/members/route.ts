import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getSessionFromRequest } from '@/server/auth/session'

function uniqueSortedNames(values: string[]) {
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
}

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.groupId) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('group_members')
      .select('player_name')
      .eq('group_id', session.groupId)

    if (error) throw new Error(error.message)

    const members = uniqueSortedNames((data ?? []).map((row) => String(row.player_name || '')))
    return NextResponse.json({ members })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Impossible de charger les membres.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
