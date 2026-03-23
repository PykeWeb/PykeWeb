import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertAdminSession } from '@/server/auth/admin'

async function clearGroupTable(supabase: ReturnType<typeof getSupabaseAdmin>, table: string, groupId: string) {
  const { error } = await supabase.from(table).delete().eq('group_id', groupId)
  if (!error) return
  if (/does not exist|relation .* does not exist|Could not find the table/i.test(error.message)) return
  throw new Error(`${table}: ${error.message}`)
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await assertAdminSession(request)
    const groupId = params.id
    const supabase = getSupabaseAdmin()

    const tables = [
      'catalog_items_group_overrides',
      'finance_transactions',
      'expenses',
      'transaction_items',
      'stock_movements',
      'transactions',
      'weapon_loans',
      'weapon_stock_movements',
      'drug_stock_movements',
      'objects',
      'weapons',
      'equipment',
      'drug_items',
      'catalog_items',
      'support_tickets',
    ]

    for (const table of tables) {
      await clearGroupTable(supabase, table, groupId)
    }

    const { error: layoutErr } = await supabase.from('ui_layouts').delete().eq('scope_type', 'group').eq('scope_id', groupId)
    if (layoutErr && !/does not exist|relation .* does not exist|Could not find the table/i.test(layoutErr.message)) throw new Error(`ui_layouts: ${layoutErr.message}`)

    const { error: preferencesErr } = await supabase.from('user_preferences').delete().eq('group_id', groupId)
    if (preferencesErr && !/does not exist|relation .* does not exist|Could not find the table/i.test(preferencesErr.message)) throw new Error(`user_preferences: ${preferencesErr.message}`)

    const { error: textsErr } = await supabase.from('ui_texts').delete().eq('scope', 'group').eq('group_id', groupId)
    if (textsErr && !/does not exist|relation .* does not exist|Could not find the table/i.test(textsErr.message)) throw new Error(`ui_texts: ${textsErr.message}`)

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Reset impossible'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
