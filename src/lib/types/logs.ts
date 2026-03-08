export type AppLogSource = 'web' | 'fivem' | 'system'

export type AppLogEntry = {
  id: string
  group_id: string
  group_name: string | null
  actor_name: string | null
  actor_source: AppLogSource
  area: string
  action: string
  entity_type: string | null
  entity_id: string | null
  message: string
  payload: Record<string, unknown> | null
  created_at: string
}

export type CreateAppLogInput = {
  area: string
  action: string
  message: string
  entity_type?: string | null
  entity_id?: string | null
  actor_name?: string | null
  actor_source?: AppLogSource
  payload?: Record<string, unknown> | null
  character_name?: string | null
  steam_name?: string | null
  steam_identifier?: string | null
  fivem_license?: string | null
}
