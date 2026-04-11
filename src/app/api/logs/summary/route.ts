import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireSession } from '@/server/auth/requireSession'
import { sessionCanAccessPrefix } from '@/server/auth/access'
import type { AppLogEntry, GroupLogsSummary } from '@/lib/types/logs'

function startOfTodayIso() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
}

export async function GET(request: Request) {
  try {
    const session = await requireSession(request)
    if (!sessionCanAccessPrefix(session, '/logs')) {
      return NextResponse.json({ error: 'Permission insuffisante pour consulter les logs.' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()
    const todayIso = startOfTodayIso()

    const { data, error } = await supabase
      .from('app_logs')
      .select('created_at,category,action_type,actor_name,user_name,amount,note')
      .eq('group_id', session.groupId)
      .gte('created_at', todayIso)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw error

    const rows = (data ?? []) as AppLogEntry[]
    const financeToday = rows.filter((row) => row.category === 'finance')
    const lastActivity = rows[0] ?? null
    const lastWithdrawal = rows.find((row) => row.action_type === 'retrait') ?? null
    const lastDeposit = rows.find((row) => row.action_type === 'depot' || row.action_type === 'entree') ?? null
    const lastWithActor = rows.find((row) => (row.actor_name || row.user_name || '').trim().length > 0) ?? null

    const summary: GroupLogsSummary = {
      todayCount: rows.length,
      todayFinanceMovements: financeToday.length,
      lastActivityAt: lastActivity?.created_at ?? null,
      lastWithdrawal: lastWithdrawal
        ? { created_at: lastWithdrawal.created_at, actor_name: lastWithdrawal.actor_name, amount: lastWithdrawal.amount, note: lastWithdrawal.note }
        : null,
      lastDeposit: lastDeposit
        ? { created_at: lastDeposit.created_at, actor_name: lastDeposit.actor_name, amount: lastDeposit.amount, note: lastDeposit.note }
        : null,
      lastActiveMember: lastWithActor
        ? { memberName: lastWithActor.actor_name || lastWithActor.user_name || '—', createdAt: lastWithActor.created_at }
        : null,
    }

    return NextResponse.json(summary)
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossible de charger le résumé.' }, { status: 400 })
  }
}
