import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireGroupSession } from '@/server/auth/requireSession'

type RouteParams = { params: { source: string; id: string } }

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await requireGroupSession(request)
    const source = params.source
    const id = params.id
    const supabase = getSupabaseAdmin()

    if (source === 'finance_transactions') {
      const { data, error } = await supabase
        .from('finance_transactions')
        .select('id,mode,quantity,unit_price,total,counterparty,payment_mode,notes,created_at,catalog_items(name,category,item_type,image_url)')
        .eq('group_id', session.groupId)
        .eq('id', id)
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 404 })
      return NextResponse.json({ source, data })
    }

    if (source === 'transactions') {
      const { data, error } = await supabase
        .from('transactions')
        .select('id,type,counterparty,total,notes,created_at,transaction_items(name_snapshot,quantity,unit_price,total,image_url_snapshot)')
        .eq('group_id', session.groupId)
        .eq('id', id)
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 404 })
      return NextResponse.json({ source, data })
    }

    if (source === 'expenses') {
      const { data, error } = await supabase
        .from('expenses')
        .select('id,member_name,item_label,item_source,quantity,unit_price,total,description,status,proof_image_url,created_at')
        .eq('group_id', session.groupId)
        .eq('id', id)
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 404 })
      return NextResponse.json({ source, data })
    }

    return NextResponse.json({ error: 'Source invalide' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Non autorisé'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
