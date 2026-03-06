import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertAdminSession } from '@/server/auth/admin'
import { normalizeWeeks, parseTabletMessage, TABLET_WEEKLY_PRICE } from '@/lib/tabletRental'

export async function GET(request: Request) {
  try {
    await assertAdminSession(request)
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id,group_id,message,image_url,status,created_at,tenant_groups(name,badge,paid_until)')
      .eq('kind', 'message')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data ?? [])
      .map((row) => {
        const parsed = parseTabletMessage(String(row.message || ''))
        if (!parsed) return null
        const tenantGroups = row.tenant_groups as { name?: string | null; badge?: string | null; paid_until?: string | null } | Array<{ name?: string | null; badge?: string | null; paid_until?: string | null }> | null
        const groupJoin = Array.isArray(tenantGroups) ? tenantGroups[0] : tenantGroups
        return {
          id: row.id,
          group_id: row.group_id,
          group_name: groupJoin?.name ?? null,
          group_badge: groupJoin?.badge ?? null,
          group_paid_until: groupJoin?.paid_until ?? null,
          weeks: parsed.weeks,
          amount: parsed.amount,
          image_url: row.image_url,
          status: row.status === 'resolved' ? 'resolved' : 'open',
          created_at: row.created_at,
        }
      })
      .filter(Boolean)

    return NextResponse.json(rows)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Non autorisé'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}

export async function PATCH(request: Request) {
  try {
    await assertAdminSession(request)
    const body = (await request.json()) as { id?: string; group_id?: string; weeks?: number }
    const ticketId = String(body.id || '')
    const groupId = String(body.group_id || '')
    const weeks = normalizeWeeks(body.weeks)
    if (!ticketId || !groupId) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: group, error: gErr } = await supabase.from('tenant_groups').select('id,paid_until').eq('id', groupId).single()
    if (gErr || !group) return NextResponse.json({ error: gErr?.message || 'Groupe introuvable' }, { status: 404 })

    const baseTs = group.paid_until ? new Date(group.paid_until).getTime() : Date.now()
    const next = new Date(Math.max(Date.now(), baseTs) + weeks * 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error: updateGroupErr } = await supabase.from('tenant_groups').update({ paid_until: next, active: true }).eq('id', groupId)
    if (updateGroupErr) return NextResponse.json({ error: updateGroupErr.message }, { status: 500 })

    const { error: updateTicketErr } = await supabase.from('support_tickets').update({ status: 'resolved' }).eq('id', ticketId)
    if (updateTicketErr) return NextResponse.json({ error: updateTicketErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, added_amount: weeks * TABLET_WEEKLY_PRICE })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
