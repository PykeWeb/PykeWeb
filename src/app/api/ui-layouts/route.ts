import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { readTenantServerSession } from '@/lib/server/tenantServerSession'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(request: Request) {
  const session = await readTenantServerSession()
  if (!session?.groupId) return jsonError('Non autorisé', 401)

  const pageKey = new URL(request.url).searchParams.get('page_key')
  if (!pageKey) return jsonError('page_key manquant')

  const supabase = getSupabaseAdmin()
  const isAdmin = Boolean(session.isAdmin || session.groupId === 'admin')

  if (isAdmin) {
    const { data: global } = await supabase
      .from('ui_layouts')
      .select('order')
      .eq('scope_type', 'global')
      .is('scope_id', null)
      .eq('page_key', pageKey)
      .maybeSingle()
    if (global?.order) return NextResponse.json({ order: global.order })
  }

  if (session.groupId !== 'admin') {
    const { data: group } = await supabase
      .from('ui_layouts')
      .select('order')
      .eq('scope_type', 'group')
      .eq('scope_id', session.groupId)
      .eq('page_key', pageKey)
      .maybeSingle()
    if (group?.order) return NextResponse.json({ order: group.order })
  }

  return NextResponse.json({ order: [] })
}

export async function POST(request: Request) {
  const session = await readTenantServerSession()
  if (!session?.groupId) return jsonError('Non autorisé', 401)

  const body = await request.json()
  if (!body?.page_key || !Array.isArray(body?.order)) return jsonError('Payload invalide')

  const isAdmin = Boolean(session.isAdmin || session.groupId === 'admin')
  const scopeType = body?.scope_type === 'global' && isAdmin ? 'global' : 'group'
  const scopeId = scopeType === 'global' ? null : session.groupId

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('ui_layouts').upsert(
    {
      scope_type: scopeType,
      scope_id: scopeId,
      page_key: body.page_key,
      order: body.order,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'scope_type,scope_id,page_key' }
  )

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const session = await readTenantServerSession()
  if (!session?.groupId) return jsonError('Non autorisé', 401)

  const body = await request.json()
  if (!body?.page_key) return jsonError('page_key manquant')

  const isAdmin = Boolean(session.isAdmin || session.groupId === 'admin')
  const scopeType = body?.scope_type === 'global' && isAdmin ? 'global' : 'group'
  const scopeId = scopeType === 'global' ? null : session.groupId

  const supabase = getSupabaseAdmin()
  let q = supabase.from('ui_layouts').delete().eq('scope_type', scopeType).eq('page_key', body.page_key)
  q = scopeId ? q.eq('scope_id', scopeId) : q.is('scope_id', null)
  const { error } = await q

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true })
}
