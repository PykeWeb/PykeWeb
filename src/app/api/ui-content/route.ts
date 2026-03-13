import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { normalizePageHeaderContentConfig } from '@/lib/types/uiContent'

function pageToKey(page: string) {
  return `ui_content:${page}`
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const page = url.searchParams.get('page')?.trim()
    if (!page) return NextResponse.json({ config: normalizePageHeaderContentConfig(null) })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('ui_texts')
      .select('value')
      .eq('scope', 'global')
      .is('group_id', null)
      .eq('key', pageToKey(page))
      .maybeSingle<{ value: string | null }>()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let parsed: unknown = null
    if (typeof data?.value === 'string' && data.value.trim()) {
      try {
        parsed = JSON.parse(data.value)
      } catch {
        parsed = null
      }
    }

    return NextResponse.json({ config: normalizePageHeaderContentConfig(parsed) })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 })
  }
}
