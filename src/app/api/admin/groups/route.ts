import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdminSession } from '@/lib/server/tenantServerSession'

const TABLE = 'tenant_groups'

export async function GET(request: Request) {
  try {
    await requireAdminSession(request)
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from(TABLE)
      .select('id,name,badge,login,password,active,paid_until,created_at')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Non autorisé' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession(request)
    const body = await request.json()
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from(TABLE)
      .insert(body)
      .select('id,name,badge,login,password,active,paid_until,created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminSession(request)
    const body = await request.json()
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from(TABLE)
      .update(body.patch || {})
      .eq('id', String(body.id))
      .select('id,name,badge,login,password,active,paid_until,created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminSession(request)
    const body = await request.json()
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from(TABLE).delete().eq('id', String(body.id))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 400 })
  }
}
