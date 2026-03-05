import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getSessionFromRequest } from '@/server/auth/session'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function isAdminSession(session: { isAdmin?: boolean; groupId: string }) {
  return Boolean(session.isAdmin || session.groupId === 'admin')
}

function resolveScope(bodyOrQuery: { scope_type?: string | null; scope_id?: string | null }, session: { groupId: string; isAdmin?: boolean }) {
  const isAdmin = isAdminSession(session)
  const requestedScopeType = bodyOrQuery.scope_type === 'global' ? 'global' : 'group'
  const requestedScopeId = bodyOrQuery.scope_id || null

  if (requestedScopeType === 'global') {
    if (!isAdmin) return { scopeType: 'group' as const, scopeId: session.groupId }
    return { scopeType: 'global' as const, scopeId: null }
  }

  if (!isAdmin) return { scopeType: 'group' as const, scopeId: session.groupId }
  return { scopeType: 'group' as const, scopeId: requestedScopeId || session.groupId }
}

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request)
  if (!session?.groupId) return jsonError('Non autorisé', 401)
  const safeSession = { groupId: session.groupId, isAdmin: session.isAdmin }

  const params = new URL(request.url).searchParams
  const pageKey = params.get('page_key')
  if (!pageKey) return jsonError('page_key manquant')

  const supabase = getSupabaseAdmin()
  const requestedScopeType = params.get('scope_type')
  const requestedScopeId = params.get('scope_id')

  // Backward compatibility: when no explicit scope is passed, keep old fallback behavior.
  if (!requestedScopeType) {
    const { data: globalRow } = await supabase
      .from('ui_layouts')
      .select('order')
      .eq('scope_type', 'global')
      .is('scope_id', null)
      .eq('page_key', pageKey)
      .maybeSingle<{ order: string[] | null }>()

    const { data: groupRow } = await supabase
      .from('ui_layouts')
      .select('order')
      .eq('scope_type', 'group')
      .eq('scope_id', session.groupId)
      .eq('page_key', pageKey)
      .maybeSingle<{ order: string[] | null }>()

    const merged = [
      ...(Array.isArray(globalRow?.order) ? globalRow.order : []),
      ...(Array.isArray(groupRow?.order) ? groupRow.order : []),
    ]
    return NextResponse.json({ order: Array.from(new Set(merged)) })
  }

  const scope = resolveScope({
    scope_type: requestedScopeType,
    scope_id: requestedScopeId,
  }, safeSession)

  // Allow any signed-in group to read global scope for feature flags/config.
  const finalScopeType = requestedScopeType === 'global' ? 'global' : scope.scopeType
  const finalScopeId = finalScopeType === 'global' ? null : scope.scopeId

  let query = supabase
    .from('ui_layouts')
    .select('order')
    .eq('scope_type', finalScopeType)
    .eq('page_key', pageKey)

  query = finalScopeId ? query.eq('scope_id', finalScopeId) : query.is('scope_id', null)

  const { data, error } = await query.maybeSingle<{ order: string[] | null }>()
  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ order: Array.isArray(data?.order) ? data.order : [] })
}


export async function POST(request: Request) {
  const session = await getSessionFromRequest(request)
  if (!session?.groupId) return jsonError('Non autorisé', 401)
  const safeSession = { groupId: session.groupId, isAdmin: session.isAdmin }

  const body = await request.json()
  if (!body?.page_key || !Array.isArray(body?.order)) return jsonError('Payload invalide')

  const scope = resolveScope({
    scope_type: typeof body.scope_type === 'string' ? body.scope_type : null,
    scope_id: typeof body.scope_id === 'string' ? body.scope_id : null,
  }, safeSession)

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('ui_layouts').upsert(
    {
      scope_type: scope.scopeType,
      scope_id: scope.scopeId,
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
  const session = await getSessionFromRequest(request)
  if (!session?.groupId) return jsonError('Non autorisé', 401)
  const safeSession = { groupId: session.groupId, isAdmin: session.isAdmin }

  const body = await request.json()
  if (!body?.page_key) return jsonError('page_key manquant')

  const scope = resolveScope({
    scope_type: typeof body.scope_type === 'string' ? body.scope_type : null,
    scope_id: typeof body.scope_id === 'string' ? body.scope_id : null,
  }, safeSession)

  const supabase = getSupabaseAdmin()
  let query = supabase.from('ui_layouts').delete().eq('scope_type', scope.scopeType).eq('page_key', body.page_key)
  query = scope.scopeId ? query.eq('scope_id', scope.scopeId) : query.is('scope_id', null)
  const { error } = await query

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true })
}
