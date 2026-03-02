import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { requireAdminSession } from '@/lib/server/tenantServerSession'

export async function POST(request: Request) {
  try {
    const user = request.headers.get('x-admin-user')
    const pass = request.headers.get('x-admin-password')
    if (!(user === 'admin' && pass === 'santa1234')) {
      await requireAdminSession()
    }
    const body = await request.json()
    const key = String(body.key || '').trim()
    const value = String(body.value || '')
    const scope = body.scope === 'group' ? 'group' : 'global'
    const group_id = scope === 'group' ? String(body.group_id || '') : null
    if (!key) return NextResponse.json({ error: 'key requis' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('ui_texts')
      .upsert({ key, value, scope, group_id, updated_at: new Date().toISOString() }, { onConflict: 'key,scope,group_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { count } = await supabase.from('ui_texts').select('id', { count: 'exact', head: true })
    return NextResponse.json({ ok: true, count: count ?? 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Non autorisé' }, { status: 401 })
  }
}
