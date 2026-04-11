export type AppLogSource = 'web' | 'fivem' | 'system' | 'api' | 'discord' | 'admin'

export type AppLogCategory = 'finance' | 'stock' | 'drugs' | 'weapons' | 'admin' | 'discord' | 'system' | 'tablet' | 'activity' | 'other'

export type AppLogActionType =
  | 'creation'
  | 'modification'
  | 'suppression'
  | 'entree'
  | 'sortie'
  | 'achat'
  | 'vente'
  | 'depot'
  | 'retrait'
  | 'pret'
  | 'retour'
  | 'webhook_configuration'
  | 'webhook_test'
  | 'permission_modifiee'
  | 'autre'

export type AppLogEntry = {
  id: string
  group_id: string
  group_name: string | null
  user_id: string | null
  actor_name: string | null
  user_name: string | null
  actor_source: AppLogSource
  source: AppLogSource
  category: AppLogCategory
  area: string
  action_type: AppLogActionType
  action: string
  target_type: string | null
  entity_type: string | null
  target_name: string | null
  entity_id: string | null
  quantity: number | null
  amount: number | null
  before_value: string | null
  after_value: string | null
  message: string
  note: string | null
  payload: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type CreateAppLogInput = {
  area: string
  action: string
  message: string
  category?: AppLogCategory | null
  action_type?: AppLogActionType | null
  target_type?: string | null
  target_name?: string | null
  quantity?: number | null
  amount?: number | null
  before_value?: string | number | null
  after_value?: string | number | null
  note?: string | null
  source?: AppLogSource | null
  metadata?: Record<string, unknown> | null
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

export type GroupLogsSummary = {
  todayCount: number
  todayFinanceMovements: number
  lastActivityAt: string | null
  lastWithdrawal: Pick<AppLogEntry, 'created_at' | 'actor_name' | 'amount' | 'note'> | null
  lastDeposit: Pick<AppLogEntry, 'created_at' | 'actor_name' | 'amount' | 'note'> | null
  lastActiveMember: { memberName: string; createdAt: string } | null
}

export type GroupWebhookStatus = {
  configured: boolean
  valid: boolean | null
  maskedWebhookUrl: string | null
  updatedAt: string | null
}
