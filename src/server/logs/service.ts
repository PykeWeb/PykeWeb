import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AppServerSession } from '@/server/auth/session'
import type { AppLogActionType, AppLogCategory, AppLogEntry, AppLogSource, GroupWebhookStatus } from '@/lib/types/logs'

const WEBHOOK_RE = /^https:\/\/discord\.com\/api\/webhooks\/[\w-]+\/[\w-]+$/i

function toText(value: unknown) {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v.length ? v : null
}

function toNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringifyValue(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const t = value.trim()
    return t.length ? t : null
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

export function inferCategory(area: string, explicit: unknown): AppLogCategory {
  const asText = toText(explicit)
  if (asText && ['finance', 'stock', 'drugs', 'weapons', 'admin', 'discord', 'system', 'other'].includes(asText)) {
    return asText as AppLogCategory
  }
  const normalized = area.toLowerCase()
  if (normalized.includes('finance') || normalized.includes('cash') || normalized.includes('expense')) return 'finance'
  if (normalized.includes('stock') || normalized.includes('items') || normalized.includes('tablette')) return 'stock'
  if (normalized.includes('drog') || normalized.includes('meth')) return 'drugs'
  if (normalized.includes('arme') || normalized.includes('weapon')) return 'weapons'
  if (normalized.includes('admin') || normalized.includes('group') || normalized.includes('permission')) return 'admin'
  if (normalized.includes('discord') || normalized.includes('webhook')) return 'discord'
  if (normalized.includes('system')) return 'system'
  return 'other'
}

export function inferActionType(action: string, explicit: unknown): AppLogActionType {
  const asText = toText(explicit)
  const allowed: AppLogActionType[] = ['creation', 'modification', 'suppression', 'entree', 'sortie', 'achat', 'vente', 'depot', 'retrait', 'pret', 'retour', 'webhook_configuration', 'webhook_test', 'permission_modifiee', 'autre']
  if (asText && allowed.includes(asText as AppLogActionType)) return asText as AppLogActionType

  const normalized = action.toLowerCase()
  if (['create', 'created', 'creation', 'add', 'added'].some((k) => normalized.includes(k))) return 'creation'
  if (['update', 'updated', 'edit', 'modified', 'status'].some((k) => normalized.includes(k))) return 'modification'
  if (['delete', 'removed', 'suppression'].some((k) => normalized.includes(k))) return 'suppression'
  if (normalized.includes('buy') || normalized.includes('achat')) return 'achat'
  if (normalized.includes('sell') || normalized.includes('vente')) return 'vente'
  if (normalized.includes('deposit') || normalized.includes('depot')) return 'depot'
  if (normalized.includes('withdraw') || normalized.includes('retrait')) return 'retrait'
  if (normalized.includes('in') || normalized.includes('entree')) return 'entree'
  if (normalized.includes('out') || normalized.includes('sortie')) return 'sortie'
  if (normalized.includes('loan') || normalized.includes('pret')) return 'pret'
  if (normalized.includes('return') || normalized.includes('retour')) return 'retour'
  if (normalized.includes('webhook') && normalized.includes('test')) return 'webhook_test'
  if (normalized.includes('webhook')) return 'webhook_configuration'
  if (normalized.includes('permission')) return 'permission_modifiee'
  return 'autre'
}

export function maskDiscordWebhook(webhook: string | null) {
  if (!webhook) return null
  const parts = webhook.split('/')
  if (parts.length < 2) return 'https://discord.com/api/webhooks/****/****'
  return `https://discord.com/api/webhooks/${parts[parts.length - 2] ? '****' : '****'}/****`
}

export function isValidDiscordWebhookUrl(value: string) {
  return WEBHOOK_RE.test(String(value || '').trim())
}

export async function readGroupWebhookStatus(groupId: string): Promise<GroupWebhookStatus> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tenant_groups')
    .select('discord_webhook_url, discord_webhook_valid, discord_webhook_updated_at')
    .eq('id', groupId)
    .maybeSingle<{ discord_webhook_url: string | null; discord_webhook_valid: boolean | null; discord_webhook_updated_at: string | null }>()
  if (error) throw new Error(error.message)
  const webhook = toText(data?.discord_webhook_url)
  return {
    configured: Boolean(webhook),
    valid: typeof data?.discord_webhook_valid === 'boolean' ? data.discord_webhook_valid : null,
    maskedWebhookUrl: maskDiscordWebhook(webhook),
    updatedAt: data?.discord_webhook_updated_at ?? null,
  }
}

export function buildLogRecord(input: {
  session: AppServerSession
  actorName: string | null
  actorSource: AppLogSource
  area: string
  action: string
  message: string
  payload: Record<string, unknown> | null
  entityType: string | null
  entityId: string | null
  body: Record<string, unknown>
}) {
  const payload = input.payload
  const category = inferCategory(input.area, input.body.category ?? payload?.category)
  const actionType = inferActionType(input.action, input.body.action_type ?? payload?.action_type)

  return {
    group_id: input.session.groupId,
    group_name: input.session.groupName,
    user_id: input.session.memberId ?? null,
    user_name: toText(input.body.user_name) ?? toText(payload?.member_name) ?? input.session.memberName ?? input.actorName,
    actor_name: input.actorName,
    actor_source: input.actorSource,
    source: (toText(input.body.source) as AppLogSource | null) ?? input.actorSource,
    area: input.area,
    category,
    action: input.action,
    action_type: actionType,
    target_type: toText(input.body.target_type) ?? toText(input.body.entity_type) ?? input.entityType,
    target_name: toText(input.body.target_name) ?? toText(payload?.item_name),
    entity_type: input.entityType,
    entity_id: input.entityId,
    quantity: toNullableNumber(input.body.quantity ?? payload?.quantity),
    amount: toNullableNumber(input.body.amount ?? payload?.total ?? payload?.cash_moved),
    before_value: stringifyValue(input.body.before_value ?? payload?.before ?? payload?.before_value),
    after_value: stringifyValue(input.body.after_value ?? payload?.after ?? payload?.after_value),
    note: toText(input.body.note ?? payload?.note ?? payload?.reason),
    message: input.message,
    payload,
    metadata: (typeof input.body.metadata === 'object' && input.body.metadata && !Array.isArray(input.body.metadata)
      ? input.body.metadata
      : null) as Record<string, unknown> | null,
  }
}

function colorForActionType(actionType: AppLogActionType) {
  if (['entree', 'achat', 'depot', 'creation', 'retour'].includes(actionType)) return 0x22c55e
  if (['sortie', 'vente', 'retrait', 'suppression', 'pret'].includes(actionType)) return 0xef4444
  if (['modification', 'permission_modifiee'].includes(actionType)) return 0xeab308
  return 0x38bdf8
}

export async function sendDiscordLogIfConfigured(entry: Pick<AppLogEntry, 'group_id' | 'group_name' | 'actor_name' | 'category' | 'action' | 'action_type' | 'target_name' | 'quantity' | 'amount' | 'before_value' | 'after_value' | 'note' | 'message' | 'created_at'>) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('tenant_groups').select('discord_webhook_url').eq('id', entry.group_id).maybeSingle<{ discord_webhook_url: string | null }>()
  if (error) return
  const webhook = toText(data?.discord_webhook_url)
  if (!webhook || !isValidDiscordWebhookUrl(webhook)) return

  const fields = [
    { name: 'Groupe', value: entry.group_name || entry.group_id, inline: true },
    { name: 'Membre', value: entry.actor_name || '—', inline: true },
    { name: 'Catégorie', value: entry.category, inline: true },
    { name: 'Action', value: entry.action, inline: true },
    { name: 'Cible', value: entry.target_name || '—', inline: true },
    { name: 'Date', value: new Date(entry.created_at).toLocaleString('fr-FR'), inline: true },
  ]

  if (entry.quantity != null) fields.push({ name: 'Quantité', value: String(entry.quantity), inline: true })
  if (entry.amount != null) fields.push({ name: 'Montant', value: `${entry.amount.toLocaleString('fr-FR')} $`, inline: true })
  if (entry.before_value) fields.push({ name: 'Avant', value: entry.before_value.slice(0, 500), inline: false })
  if (entry.after_value) fields.push({ name: 'Après', value: entry.after_value.slice(0, 500), inline: false })
  if (entry.note) fields.push({ name: 'Note', value: entry.note.slice(0, 500), inline: false })

  const payload = {
    embeds: [{
      title: entry.message || `Log ${entry.category}`,
      description: `Type: ${entry.action_type}`,
      color: colorForActionType(entry.action_type),
      fields,
      timestamp: entry.created_at,
    }],
  }

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    await supabase
      .from('tenant_groups')
      .update({ discord_webhook_valid: response.ok, discord_webhook_last_error: response.ok ? null : `HTTP ${response.status}`, discord_webhook_updated_at: new Date().toISOString() })
      .eq('id', entry.group_id)
  } catch {
    await supabase
      .from('tenant_groups')
      .update({ discord_webhook_valid: false, discord_webhook_last_error: 'NETWORK_ERROR', discord_webhook_updated_at: new Date().toISOString() })
      .eq('id', entry.group_id)
  }
}
