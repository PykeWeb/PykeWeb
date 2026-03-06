import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertAdminSession } from '@/server/auth/admin'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await assertAdminSession(request)
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('catalog_items')
      .select('id,name,category,item_type,buy_price,stock')
      .eq('group_id', params.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Non autorisé'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
