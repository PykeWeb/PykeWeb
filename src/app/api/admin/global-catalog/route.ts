import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdminSession } from '@/lib/server/tenantServerSession'

export async function GET(request: Request) {
  try {
    await requireAdminSession()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const supabase = getSupabaseAdmin()
    let q = supabase.from('catalog_items_global').select('*').order('created_at', { ascending: false })
    if (category) q = q.eq('category', category)
    const { data, error } = await q
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
    const payload = {
      category: body.category,
      item_type: body.item_type ?? null,
      name: String(body.name || '').trim(),
      price: Number(body.price || 0),
      default_quantity: Math.max(0, Number(body.default_quantity ?? 0)),
      description: body.description ?? null,
      image_url: body.image_url ?? null,
      weapon_id: body.weapon_id ?? null,
    }
    if (!payload.name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    const { data, error } = await supabase.from('catalog_items_global').insert(payload).select('*').single()
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
    const { id, patch } = body
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('catalog_items_global')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
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
    const { error } = await supabase.from('catalog_items_global').delete().eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 400 })
  }
}
