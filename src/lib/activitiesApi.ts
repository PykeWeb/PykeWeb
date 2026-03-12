import type { ActivityEntry, ActivityMemberSummary, ActivitySettings, ActivityType } from '@/lib/types/activities'
import { withTenantSessionHeader } from '@/lib/tenantRequest'

export type ActivityListResponse = {
  entries: ActivityEntry[]
  summaries: ActivityMemberSummary[]
  settings: ActivitySettings
}

export async function listActivities(weekStartIso?: string): Promise<ActivityListResponse> {
  const query = weekStartIso ? `?weekStart=${encodeURIComponent(weekStartIso)}` : ''
  const res = await fetch(`/api/activities${query}`, withTenantSessionHeader({ cache: 'no-store' }))
  if (!res.ok) throw new Error((await res.text()) || 'Impossible de charger les activités.')
  return res.json() as Promise<ActivityListResponse>
}

export async function createActivity(payload: {
  member_name: string
  activity_type: ActivityType
  object_item_id: string
  quantity: number
  equipment_item_id: string | null
  equipment_quantity: number
  percent_per_object: number
  proof_image_data: string
}) {
  const res = await fetch('/api/activities', withTenantSessionHeader({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
  if (!res.ok) throw new Error((await res.text()) || 'Impossible d\'ajouter l\'activité.')
}

export async function updateActivitySettings(payload: { default_percent_per_object: number }) {
  const res = await fetch('/api/activities/settings', withTenantSessionHeader({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
  if (!res.ok) throw new Error((await res.text()) || 'Impossible de modifier les paramètres.')
}
