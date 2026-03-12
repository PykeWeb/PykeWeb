import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertAdminSession } from '@/server/auth/admin'
import { parseGroupCredentials } from '@/lib/groupCredentials'

type GroupRecord = {
  id: string
  name: string
  badge: string | null
  login: string
  password: string
  active: boolean
  paid_until: string | null
  created_at?: string
}

function normalizeGroupRecord(row: GroupRecord) {
  const credentials = parseGroupCredentials(row.password)
  return {
    ...row,
    password: credentials.chefPassword,
    password_member: credentials.memberPassword,
  }
}

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
    if (byId) return NextResponse.json(normalizeGroupRecord(byId as GroupRecord))

    const { data: byLogin, error: byLoginError } = await supabase
      .from('tenant_groups')
      .select(selectColumns)
      .eq('login', params.id)
      .maybeSingle()

    if (byLoginError) return NextResponse.json({ error: byLoginError.message }, { status: 500 })
    if (!byLogin) return NextResponse.json({ error: 'Groupe introuvable.' }, { status: 404 })
    return NextResponse.json(normalizeGroupRecord(byLogin as GroupRecord))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Non autorisé'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
