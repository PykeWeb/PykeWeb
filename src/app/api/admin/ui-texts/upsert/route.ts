import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireAdminSessionFromRequest } from '@/lib/server/tenantServerSession'

export async function POST(request: Request) {
  try {
    const user = request.headers.get('x-admin-user')
    const pass = request.headers.get('x-admin-password')
    if (!(user === 'admin' && pass === 'santa1234')) {
      await requireAdminSession(request)
    }
    const body = await request.json()
    const key = String(body.key || '').trim()
    const value = String(body.value || '')
    const scope = body.scope === 'group' ? 'group' : 'global'
    const group_id = scope === 'group' ? String(body.group_id || '') : null
    if (!key) return NextResponse.json({ error: 'key requis' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const payload = { key, value, scope, group_id, updated_at: new Date().toISOString() }
    let operationError: string | null = null

    if (scope === 'group') {
      const { data: existing, error: findError } = await supabase
        .from('ui_texts')
        .select('id')
        .eq('key', key)
        .eq('scope', 'group')
        .eq('group_id', group_id)
        .maybeSingle()
      if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })

      if (existing?.id) {
        const { error } = await supabase.from('ui_texts').update(payload).eq('id', existing.id)
        if (error) operationError = error.message
      } else {
        const { error } = await supabase.from('ui_texts').insert(payload)
        if (error) operationError = error.message
      }
    } else {
      const { data: existing, error: findError } = await supabase
        .from('ui_texts')
        .select('id')
        .eq('key', key)
        .eq('scope', 'global')
        .is('group_id', null)
        .maybeSingle()
      if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })

      if (existing?.id) {
        const { error } = await supabase.from('ui_texts').update(payload).eq('id', existing.id)
        if (error) operationError = error.message
      } else {
        const { error } = await supabase.from('ui_texts').insert(payload)
        if (error) operationError = error.message
      }
    }

    if (operationError) return NextResponse.json({ error: operationError }, { status: 500 })

    const { count } = await supabase.from('ui_texts').select('id', { count: 'exact', head: true })
    return NextResponse.json({ ok: true, count: count ?? 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Non autorisé' }, { status: 401 })
  }
}
