import { withTenantSessionHeader } from '@/lib/tenantRequest'
import type { AppLogEntry, CreateAppLogInput } from '@/lib/types/logs'

async function readError(res: Response) {
  try {
    const json = (await res.json()) as { error?: string }
    return json.error || 'Erreur API'
  } catch {
    return (await res.text()) || 'Erreur API'
  }
}

export async function listGroupLogs(limit = 250): Promise<AppLogEntry[]> {
  const res = await fetch(`/api/logs?limit=${limit}`, withTenantSessionHeader({ cache: 'no-store' }))
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as AppLogEntry[]
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
    if (!res.ok) {
      // ne jamais casser le flux principal pour un souci de logs
      await readError(res)
    }
  } catch {
    // fail-safe silencieux
  }
}
