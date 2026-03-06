import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertAdminRequestAuthorized } from '@/server/auth/adminRequest'

export async function POST(request: Request) {
  try {
    await assertAdminRequestAuthorized(request)

    const body = await request.json() as { newPassword?: string }
    const newPassword = (body.newPassword || '').trim()

    if (newPassword.length < 4) {
      return NextResponse.json({ error: 'Mot de passe trop court' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('tenant_groups')
      .update({ password: newPassword })
      .eq('login', 'admin')
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data?.length) return NextResponse.json({ error: 'Compte admin introuvable' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Non autorisé' }, { status: 401 })
  }
}
