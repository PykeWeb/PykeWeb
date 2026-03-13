import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getSessionFromRequest } from '@/server/auth/session'
import { isAdminSession } from '@/lib/tenantSessionShared'
import { normalizePageHeaderContentConfig } from '@/lib/types/uiContent'

function pageToKey(page: string) {
  return `ui_content:${page}`
}

export async function PUT(request: Request) {
  const session = await getSessionFromRequest(request)
  if (!session || !isAdminSession(session)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json() as { page?: string; config?: unknown }
    const page = typeof body.page === 'string' ? body.page.trim() : ''
    if (!page) return NextResponse.json({ error: 'Page manquante' }, { status: 400 })

    const config = normalizePageHeaderContentConfig(body.config)
    const payload = {
      key: pageToKey(page),
      value: JSON.stringify(config),
      scope: 'global' as const,
      group_id: null,
      updated_at: new Date().toISOString(),
    }

    const supabase = getSupabaseAdmin()
    const { data: existing, error: findError } = await supabase
      .from('ui_texts')
      .select('id')
      .eq('key', payload.key)
      .eq('scope', 'global')
      .is('group_id', null)
      .maybeSingle<{ id: string }>()

    if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })

    const writeError = existing?.id
      ? (await supabase.from('ui_texts').update(payload).eq('id', existing.id)).error
      : (await supabase.from('ui_texts').insert(payload)).error

    if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 })

    return NextResponse.json({ ok: true, config })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 })
  }
}
