import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdminSessionFromRequest } from '@/lib/server/tenantServerSession'

export async function GET(request: Request) {
  try {
    await requireAdminSession(request)
    const { searchParams } = new URL(request.url)
    const kind = searchParams.get('kind') as 'bug' | 'message' | null
    const includeResolved = searchParams.get('includeResolved') === '1'
    const supabase = getSupabaseAdmin()
    let q = supabase
      .from('support_tickets')
      .select('id,group_id,kind,message,image_url,status,created_at,tenant_groups(name,badge)')
      .order('created_at', { ascending: false })
    if (kind) q = q.eq('kind', kind)
    if (!includeResolved) q = q.neq('status', 'resolved')
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Non autorisé' }, { status: 401 })
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminSession(request)
    const body = await request.json()
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: body.status })
      .eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 400 })
  }
}
