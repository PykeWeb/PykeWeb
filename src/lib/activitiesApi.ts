import type {
  ActivityEntry,
  ActivityEquipmentLineInput,
  ActivityMemberSummary,
  ActivityObjectLineInput,
  ActivitySettings,
  ActivityType,
} from '@/lib/types/activities'
import { withTenantSessionHeader } from '@/lib/tenantRequest'

async function readApiError(res: Response, fallback: string) {
  try {
    const json = await res.json() as { error?: string }
    return json.error || fallback
  } catch {
    try {
      return (await res.text()) || fallback
    } catch {
      return fallback
    }
  }
}

export type ActivityListResponse = {
  entries: ActivityEntry[]
  summaries: ActivityMemberSummary[]
  settings: ActivitySettings
}

export async function listActivities(options?: { weekStartIso?: string; scope?: 'week' | 'all' }): Promise<ActivityListResponse> {
  const params = new URLSearchParams()
  if (options?.weekStartIso) params.set('weekStart', options.weekStartIso)
  if (options?.scope) params.set('scope', options.scope)
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`/api/activities${query}`, withTenantSessionHeader({ cache: 'no-store' }))
  if (!res.ok) throw new Error(await readApiError(res, 'Impossible de charger les activités.'))
  return res.json() as Promise<ActivityListResponse>
}

export async function createActivity(payload: {
  member_name: string
  activity_type: ActivityType
  object_lines: ActivityObjectLineInput[]
  equipment_lines: ActivityEquipmentLineInput[]
  percent_per_object: number
  proof_image_data: string
}) {
  const res = await fetch('/api/activities', withTenantSessionHeader({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
  if (!res.ok) throw new Error(await readApiError(res, "Impossible d'ajouter l'activité."))
}

export async function updateActivitySettings(payload: { default_percent_per_object: number }) {
  const res = await fetch('/api/activities/settings', withTenantSessionHeader({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
  if (!res.ok) throw new Error(await readApiError(res, 'Impossible de modifier les paramètres.'))
}


export async function resetActivitiesCurrentWeek() {
  const res = await fetch('/api/activities', withTenantSessionHeader({ method: 'DELETE' }))
  if (!res.ok) throw new Error(await readApiError(res, 'Impossible de réinitialiser la semaine.'))
}
