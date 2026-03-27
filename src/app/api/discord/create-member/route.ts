import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { assertDiscordApiAuth } from '@/server/discord/auth'
import { buildUsernameCandidate, generateSecurePassword, hashSecret } from '@/server/discord/password'

type CreateMemberPayload = {
  group_id?: string
  rp_first_name?: string
  rp_phone_number?: string
  discord_user_id?: string
  discord_username?: string
}

type ExistingMember = {
  id: string
  player_name: string
  player_identifier: string | null
  discord_user_id: string | null
  rp_phone_number: string | null
  is_active: boolean
}

function normalizeName(raw: string) {
  return raw.trim().replace(/\s+/g, ' ')
}

function normalizePhone(raw: string) {
  return raw.replace(/\s+/g, '')
}

async function buildUniqueUsername(groupId: string, rpFirstName: string, rpPhoneNumber: string, discordUserId: string) {
  const supabase = getSupabaseAdmin()
  const base = buildUsernameCandidate(rpFirstName, rpPhoneNumber, discordUserId)

  for (let i = 0; i < 20; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i}`.slice(0, 28)
    const { data, error } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('player_identifier', candidate)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return candidate
  }

  throw new Error('Impossible de générer un identifiant unique.')
}

export async function POST(request: Request) {
  const authError = assertDiscordApiAuth(request)
  if (authError) return authError

  try {
    const body = (await request.json()) as CreateMemberPayload
    const groupId = body.group_id?.trim() || ''
    const rpFirstName = normalizeName(body.rp_first_name || '')
    const rpPhoneNumber = normalizePhone(body.rp_phone_number || '')
    const discordUserId = body.discord_user_id?.trim() || ''
    const discordUsername = body.discord_username?.trim() || ''

    if (!groupId || !rpFirstName || !rpPhoneNumber || !discordUserId) {
      return NextResponse.json({ error: 'Payload incomplet.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: existingByDiscord, error: existingDiscordError } = await supabase
      .from('group_members')
      .select('id,player_name,player_identifier,discord_user_id,rp_phone_number,is_active')
      .eq('group_id', groupId)
      .eq('discord_user_id', discordUserId)
      .maybeSingle<ExistingMember>()

    if (existingDiscordError) return NextResponse.json({ error: existingDiscordError.message }, { status: 400 })

    if (existingByDiscord?.is_active) {
      return NextResponse.json({ error: 'Ce membre Discord est déjà provisionné.', code: 'MEMBER_ALREADY_PROVISIONED' }, { status: 409 })
    }

    const { data: existingByPhone, error: existingPhoneError } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('rp_phone_number', rpPhoneNumber)
      .eq('is_active', true)
      .maybeSingle()

    if (existingPhoneError) return NextResponse.json({ error: existingPhoneError.message }, { status: 400 })
    if (existingByPhone) {
      return NextResponse.json({ error: 'Numéro RP déjà utilisé.', code: 'DUPLICATE_RP_PHONE' }, { status: 409 })
    }

    const { data: existingName, error: existingNameError } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .ilike('player_name', rpFirstName)
      .eq('is_active', true)
      .maybeSingle()

    if (existingNameError) return NextResponse.json({ error: existingNameError.message }, { status: 400 })
    if (existingName) {
      return NextResponse.json({ error: 'Prénom RP déjà utilisé.', code: 'DUPLICATE_RP_FIRST_NAME' }, { status: 409 })
    }

    const username = await buildUniqueUsername(groupId, rpFirstName, rpPhoneNumber, discordUserId)
    const plainPassword = generateSecurePassword(16)
    const passwordHash = hashSecret(plainPassword)

    if (existingByDiscord && !existingByDiscord.is_active) {
      const { data: reactivated, error: reactivateError } = await supabase
        .from('group_members')
        .update({
          player_name: rpFirstName,
          player_identifier: username,
          password: null,
          password_hash: passwordHash,
          discord_username: discordUsername || null,
          rp_phone_number: rpPhoneNumber,
          is_active: true,
          disabled_at: null,
          discord_user_id: discordUserId,
        })
        .eq('id', existingByDiscord.id)
        .eq('group_id', groupId)
        .select('id')
        .maybeSingle()

      if (reactivateError) return NextResponse.json({ error: reactivateError.message }, { status: 400 })
      return NextResponse.json({
        member_id: reactivated?.id,
        username,
        password: plainPassword,
        rp_first_name: rpFirstName,
        rp_phone_number: rpPhoneNumber,
        reactivated: true,
      })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('group_members')
      .insert({
        group_id: groupId,
        player_name: rpFirstName,
        player_identifier: username,
        password: null,
        password_hash: passwordHash,
        discord_user_id: discordUserId,
        discord_username: discordUsername || null,
        rp_phone_number: rpPhoneNumber,
        is_admin: false,
        is_active: true,
        disabled_at: null,
      })
      .select('id')
      .maybeSingle()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

    return NextResponse.json({
      member_id: inserted?.id,
      username,
      password: plainPassword,
      rp_first_name: rpFirstName,
      rp_phone_number: rpPhoneNumber,
      reactivated: false,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 400 })
  }
}
