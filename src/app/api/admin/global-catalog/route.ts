import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdminSessionFromRequest } from '@/lib/server/tenantServerSession'
import { normalizeCatalogCategory } from '@/lib/catalogConfig'

export async function GET(request: Request) {
  try {
    await requireAdminSessionFromRequest(request)
    const { searchParams } = new URL(request.url)
    const category = normalizeCatalogCategory(searchParams.get('category'))
    const supabase = getSupabaseAdmin()
    let q = supabase.from('catalog_items_global').select('*').order('created_at', { ascending: false })
    if (category) q = q.eq('category', category)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Non autorisé'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSessionFromRequest(request)
    const body = (await request.json()) as Record<string, unknown>
    const category = normalizeCatalogCategory(String(body.category ?? ''))
    if (!category) return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 })

    const payload = {
      category,
      item_type: typeof body.item_type === 'string' ? body.item_type : null,
      name: String(body.name || '').trim(),
      price: Math.max(0, Number(body.price || 0) || 0),
      default_quantity: Math.max(0, Number(body.default_quantity ?? 0) || 0),
      description: typeof body.description === 'string' ? body.description : null,
      image_url: typeof body.image_url === 'string' ? body.image_url : null,
      weapon_id: typeof body.weapon_id === 'string' ? body.weapon_id : null,
    }

    if (!payload.name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('catalog_items_global').insert(payload).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminSessionFromRequest(request)
    const body = (await request.json()) as { id?: string; patch?: Record<string, unknown> }
    if (!body.id || !body.patch) return NextResponse.json({ error: 'Payload invalide' }, { status: 400 })

    const patch: Record<string, unknown> = { ...body.patch, updated_at: new Date().toISOString() }
    if (typeof patch.category === 'string') {
      const normalized = normalizeCatalogCategory(patch.category)
      if (!normalized) return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 })
      patch.category = normalized
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('catalog_items_global').update(patch).eq('id', body.id).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminSessionFromRequest(request)
    const body = (await request.json()) as { id?: string }
    if (!body.id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('catalog_items_global').delete().eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
