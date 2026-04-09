import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireSession } from '@/server/auth/requireSession'
import type { AppLogEntry, AppLogSource, CreateAppLogInput } from '@/lib/types/logs'

function toSafeLimit(raw: string | null, fallback: number) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(1000, Math.max(1, Math.floor(n)))
}

function toText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function pickFirstText(...values: unknown[]): string | null {
  for (const value of values) {
    const text = toText(value)
    if (text) return text
  }
  return null
}

function pickPayloadText(payload: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!payload) return null
  for (const key of keys) {
    const value = toText(payload[key])
    if (value) return value
  }
  return null
}

function normalizeActorSource(value: unknown): AppLogSource {
  return value === 'fivem' || value === 'system' ? value : 'web'
}

function mergeActorPayload(args: {
  payload: Record<string, unknown> | null | undefined
  actorSource: AppLogSource
  memberName: string | null
  characterName: string | null
  steamName: string | null
  steamIdentifier: string | null
  fivemLicense: string | null
  playerName: string | null
}): Record<string, unknown> | null {
  const base = args.payload ? { ...args.payload } : {}

  if (args.memberName) base.member_name = args.memberName
  if (args.characterName) base.character_name = args.characterName
  if (args.steamName) base.steam_name = args.steamName
  if (args.steamIdentifier) base.steam_identifier = args.steamIdentifier
  if (args.fivemLicense) base.fivem_license = args.fivemLicense
  if (args.playerName) base.player_name = args.playerName
  if (args.actorSource === 'fivem') base.actor_source = 'fivem'

  return Object.keys(base).length > 0 ? base : null
}

export async function GET(request: Request) {
  try {
    const session = await requireSession(request)
    const limit = toSafeLimit(new URL(request.url).searchParams.get('limit'), 250)
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('app_logs')
      .select('*')
      .eq('group_id', session.groupId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return NextResponse.json((data ?? []) as AppLogEntry[])
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossible de charger les logs.' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(request)
    const body = (await request.json()) as CreateAppLogInput
    if (!body?.area?.trim() || !body?.action?.trim() || !body?.message?.trim()) {
      return NextResponse.json({ error: 'area/action/message sont requis.' }, { status: 400 })
    }

    const actorSource = normalizeActorSource(body.actor_source)
    const headerPlayerName = toText(request.headers.get('x-fivem-player-name'))
    const headerCharacterName = toText(request.headers.get('x-fivem-character-name'))
    const headerSteamName = toText(request.headers.get('x-fivem-steam-name'))
    const headerSteamIdentifier = toText(request.headers.get('x-fivem-steam-id'))
    const headerLicense = toText(request.headers.get('x-fivem-license'))

    const characterName = pickFirstText(
      body.character_name,
      headerCharacterName,
      pickPayloadText(body.payload, ['character_name', 'characterName', 'char_name', 'rp_name', 'citizen_name']),
    )

    const steamName = pickFirstText(
      body.steam_name,
      headerSteamName,
      pickPayloadText(body.payload, ['steam_name', 'steamName', 'steam_account']),
    )

    const steamIdentifier = pickFirstText(
      body.steam_identifier,
      headerSteamIdentifier,
      pickPayloadText(body.payload, ['steam_identifier', 'steam', 'steam_id']),
    )

    const fivemLicense = pickFirstText(
      body.fivem_license,
      headerLicense,
      pickPayloadText(body.payload, ['fivem_license', 'license', 'license_identifier']),
    )

    const actorName = pickFirstText(
      body.actor_name,
      session.memberName,
      headerPlayerName,
      characterName,
      steamName,
      steamIdentifier,
      fivemLicense,
      session.groupName,
    )

    const supabase = getSupabaseAdmin()
    const payload = {
      group_id: session.groupId,
      group_name: session.groupName,
      actor_name: actorName,
      actor_source: actorSource,
      area: body.area.trim(),
      action: body.action.trim(),
      entity_type: body.entity_type?.trim() || null,
      entity_id: body.entity_id?.trim() || null,
      message: body.message.trim(),
      payload: mergeActorPayload({
        payload: body.payload,
        actorSource,
        memberName: toText(session.memberName),
        characterName,
        steamName,
        steamIdentifier,
        fivemLicense,
        playerName: headerPlayerName,
      }),
    }

    const { error } = await supabase.from('app_logs').insert(payload)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d'écrire le log." }, { status: 400 })
  }
}
