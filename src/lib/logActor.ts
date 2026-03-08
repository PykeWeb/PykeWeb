import type { AppLogEntry } from '@/lib/types/logs'

function toText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function pickRecordText(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null
  for (const key of keys) {
    const value = toText(record[key])
    if (value) return value
  }
  return null
}

function pickPayloadText(payload: Record<string, unknown> | null, keys: string[]): string | null {
  return pickRecordText(payload, keys)
}

export function getLogActorDetails(log: AppLogEntry): {
  displayName: string
  characterName: string | null
  steamAccount: string | null
  fivemLicense: string | null
} {
  const payload = log.payload
  const identifiers = toRecord(payload?.identifiers)

  const characterName = pickPayloadText(payload, ['character_name', 'characterName', 'char_name', 'rp_name', 'citizen_name'])

  const steamAccount =
    pickPayloadText(payload, ['steam_name', 'steamName', 'steam_account', 'steam_identifier', 'steam'])
    || pickRecordText(identifiers, ['steam_name', 'steam'])

  const fivemLicense =
    pickPayloadText(payload, ['fivem_license', 'license', 'license_identifier'])
    || pickRecordText(identifiers, ['license', 'license2'])

  const actorName = toText(log.actor_name)
  const playerName = pickPayloadText(payload, ['player_name', 'playerName'])

  const displayName = actorName || playerName || characterName || steamAccount || fivemLicense || '—'
  return { displayName, characterName, steamAccount, fivemLicense }
}
