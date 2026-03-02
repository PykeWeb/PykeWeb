import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') || 5)
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('patch_notes')
      .select('id,title,content,is_active,created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(20, limit)))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}
