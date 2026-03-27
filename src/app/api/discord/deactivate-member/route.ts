import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertDiscordApiAuth } from '@/server/discord/auth'

type DeactivateMemberPayload = {
  group_id?: string
  discord_user_id?: string
  reason?: string
}

export async function POST(request: Request) {
  const authError = assertDiscordApiAuth(request)
  if (authError) return authError

  try {
    const body = (await request.json()) as DeactivateMemberPayload
    const groupId = body.group_id?.trim() || ''
    const discordUserId = body.discord_user_id?.trim() || ''

    if (!groupId || !discordUserId) {
      return NextResponse.json({ error: 'Payload incomplet.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: member, error: memberError } = await supabase
      .from('group_members')
      .select('id,is_active')
      .eq('group_id', groupId)
      .eq('discord_user_id', discordUserId)
      .maybeSingle<{ id: string; is_active: boolean }>()

    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 400 })
    if (!member) return NextResponse.json({ ok: true, deactivated: false, reason: 'NOT_FOUND' })

    if (!member.is_active) {
      return NextResponse.json({ ok: true, deactivated: false, reason: 'ALREADY_INACTIVE', member_id: member.id })
    }

    const { error: updateError } = await supabase
      .from('group_members')
      .update({
        is_active: false,
        disabled_at: new Date().toISOString(),
      })
      .eq('id', member.id)
      .eq('group_id', groupId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    return NextResponse.json({ ok: true, deactivated: true, member_id: member.id, reason: body.reason || 'DISCORD_LEAVE' })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 400 })
  }
}
