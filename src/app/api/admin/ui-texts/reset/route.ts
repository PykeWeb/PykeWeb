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

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('ui_texts').delete().eq('scope', 'global')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Non autorisé' }, { status: 401 })
  }
}
