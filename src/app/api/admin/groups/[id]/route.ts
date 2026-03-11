import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertAdminSession } from '@/server/auth/admin'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await assertAdminSession(request)
    const supabase = getSupabaseAdmin()
    const selectColumns = 'id,name,badge,login,password,active,paid_until,created_at'
    const { data: byId, error: byIdError } = await supabase
      .from('tenant_groups')
      .select(selectColumns)
      .eq('id', params.id)
      .maybeSingle()

    if (byIdError) return NextResponse.json({ error: byIdError.message }, { status: 500 })
    if (byId) return NextResponse.json(byId)

    const { data: byLogin, error: byLoginError } = await supabase
      .from('tenant_groups')
      .select(selectColumns)
      .eq('login', params.id)
      .maybeSingle()

    if (byLoginError) return NextResponse.json({ error: byLoginError.message }, { status: 500 })
    if (!byLogin) return NextResponse.json({ error: 'Groupe introuvable.' }, { status: 404 })
    return NextResponse.json(byLogin)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Non autorisé'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
