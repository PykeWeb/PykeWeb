import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdminSession } from '@/lib/server/tenantServerSession'

export async function GET() {
  try {
    await requireAdminSession()
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('patch_notes').select('id,title,content,is_active,created_at').order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Non autorisé' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession()
    const body = await request.json()
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('patch_notes')
      .insert({ title: String(body.title || ''), content: String(body.content || ''), is_active: Boolean(body.is_active) })
      .select('id,title,content,is_active,created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminSession()
    const body = await request.json()
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('patch_notes')
      .update(body.patch || {})
      .eq('id', String(body.id))
      .select('id,title,content,is_active,created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminSession()
    const body = await request.json()
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('patch_notes').delete().eq('id', String(body.id))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 400 })
  }
}
