import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getSessionFromRequest } from '@/server/auth/session'

function uniqueSortedNames(values: string[]) {
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
}

async function collectNamesFromTable(table: string, column: string, groupId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .eq('group_id', groupId)
    .limit(500)

  if (error) return []
  return (data ?? [])
    .map((row) => {
      const safeRow = row as unknown as Record<string, unknown>
      return String(safeRow[column] || '').trim()
    })
    .filter(Boolean)
}

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session?.groupId) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })

    const [groupMembers, activityMembers, tabletMembers, expenseMembers] = await Promise.all([
      collectNamesFromTable('group_members', 'player_name', session.groupId),
      collectNamesFromTable('group_activity_entries', 'member_name', session.groupId),
      collectNamesFromTable('tablet_daily_runs', 'member_name', session.groupId),
      collectNamesFromTable('expenses', 'member_name', session.groupId),
    ])

    const sessionMember = String(session.memberName || '').trim()
    const members = uniqueSortedNames([
      ...groupMembers,
      ...activityMembers,
      ...tabletMembers,
      ...expenseMembers,
      ...(sessionMember ? [sessionMember] : []),
    ])
    return NextResponse.json({ members })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Impossible de charger les membres.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
