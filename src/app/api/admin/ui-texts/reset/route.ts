import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertAdminRequestAuthorized } from '@/server/auth/adminRequest'

export async function POST(request: Request) {
  try {
    await assertAdminRequestAuthorized(request)

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('ui_texts').delete().eq('scope', 'global')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Non autorisé' }, { status: 401 })
  }
}
