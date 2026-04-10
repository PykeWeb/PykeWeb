import { withTenantSessionHeader } from '@/lib/tenantRequest'
import type { AppLogActionType, AppLogCategory, AppLogEntry, CreateAppLogInput, GroupLogsSummary, GroupWebhookStatus } from '@/lib/types/logs'

async function readError(res: Response) {
  try {
    const json = (await res.json()) as { error?: string }
    return json.error || 'Erreur API'
  } catch {
    return (await res.text()) || 'Erreur API'
  }
}

export type LogsFilters = {
  limit?: number
  query?: string
  member?: string
  category?: AppLogCategory | 'all'
  actionType?: AppLogActionType | 'all'
  startDate?: string
  endDate?: string
}

function buildLogsQuery(filters: LogsFilters) {
  const params = new URLSearchParams()
  params.set('limit', String(filters.limit ?? 300))
  if (filters.query?.trim()) params.set('query', filters.query.trim())
  if (filters.member?.trim()) params.set('member', filters.member.trim())
  if (filters.category && filters.category !== 'all') params.set('category', filters.category)
  if (filters.actionType && filters.actionType !== 'all') params.set('actionType', filters.actionType)
  if (filters.startDate) params.set('startDate', filters.startDate)
  if (filters.endDate) params.set('endDate', filters.endDate)
  return params.toString()
}

export async function listGroupLogs(filters: LogsFilters = {}): Promise<AppLogEntry[]> {
  const query = buildLogsQuery(filters)
  const res = await fetch(`/api/logs?${query}`, withTenantSessionHeader({ cache: 'no-store' }))
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as AppLogEntry[]
}

export async function listGroupLogsSummary(): Promise<GroupLogsSummary> {
  const res = await fetch('/api/logs/summary', withTenantSessionHeader({ cache: 'no-store' }))
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as GroupLogsSummary
}

export async function getGroupWebhookStatus(): Promise<GroupWebhookStatus> {
  const res = await fetch('/api/logs/webhook', withTenantSessionHeader({ cache: 'no-store' }))
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as GroupWebhookStatus
}

export async function saveGroupWebhookUrl(webhookUrl: string): Promise<GroupWebhookStatus> {
  const res = await fetch('/api/logs/webhook', withTenantSessionHeader({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl }),
  }))
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as GroupWebhookStatus
}

export async function deleteGroupWebhookUrl(): Promise<GroupWebhookStatus> {
  const res = await fetch('/api/logs/webhook', withTenantSessionHeader({ method: 'DELETE' }))
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as GroupWebhookStatus
}

export async function testGroupWebhook(): Promise<{ ok: boolean; status: GroupWebhookStatus }> {
  const res = await fetch('/api/logs/webhook/test', withTenantSessionHeader({ method: 'POST' }))
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as { ok: boolean; status: GroupWebhookStatus }
}

export async function listAdminLogs(limit = 500): Promise<AppLogEntry[]> {
  const res = await fetch(`/api/admin/logs?limit=${limit}`, withTenantSessionHeader({ cache: 'no-store' }))
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as AppLogEntry[]
}

export async function createAppLog(input: CreateAppLogInput): Promise<void> {
  try {
    const res = await fetch('/api/logs', {
      ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
      method: 'POST',
      body: JSON.stringify(input),
    })
    if (!res.ok) await readError(res)
  } catch {
    // fail-safe silencieux
  }
}
