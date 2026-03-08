import type { AppLogEntry } from '@/lib/types/logs'

function toText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function pickPayloadText(payload: Record<string, unknown> | null, keys: string[]): string | null {
  if (!payload) return null
  for (const key of keys) {
    const value = toText(payload[key])
    if (value) return value
  }
  return null
}

export function getLogActorDetails(log: AppLogEntry): { displayName: string; characterName: string | null; steamAccount: string | null } {
  const characterName = pickPayloadText(log.payload, ['character_name', 'characterName', 'char_name', 'rp_name', 'citizen_name'])
  const steamAccount = pickPayloadText(log.payload, ['steam_name', 'steamName', 'steam_account', 'steam_identifier', 'steam'])
  const actorName = toText(log.actor_name)

  const displayName = actorName || characterName || steamAccount || '—'
  return { displayName, characterName, steamAccount }
}
