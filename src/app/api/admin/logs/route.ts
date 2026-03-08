import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertAdminRequestAuthorized } from '@/server/auth/adminRequest'
import type { AppLogEntry } from '@/lib/types/logs'

function toSafeLimit(raw: string | null, fallback: number) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(3000, Math.max(1, Math.floor(n)))
}

export async function GET(request: Request) {
  try {
    await assertAdminRequestAuthorized(request)
    const supabase = getSupabaseAdmin()
    const limit = toSafeLimit(new URL(request.url).searchParams.get('limit'), 500)

    const { data, error } = await supabase
      .from('app_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return NextResponse.json((data ?? []) as AppLogEntry[])
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossible de charger les logs admin.' }, { status: 400 })
  }
}
