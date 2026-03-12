export type ActivityType = 'Cambriolage' | 'Conteneur' | 'ATM' | 'Superette' | 'Boite au lettre'

export const ACTIVITY_OPTIONS: ActivityType[] = ['Cambriolage', 'Conteneur', 'ATM', 'Superette', 'Boite au lettre']

export const EQUIPMENT_OPTIONS = ['Aucun', 'Pied de biche', 'Perceuse', 'Lockpick', 'Kit ATM'] as const

export type ActivityEntry = {
  id: string
  group_id: string
  member_name: string
  activity_type: ActivityType
  equipment: string | null
  item_name: string
  quantity: number
  proof_image_data: string
  created_at: string
}

export type ActivitySettings = {
  group_id: string
  percent_per_object: number
  weekly_base_salary: number
}

export type ActivityMemberSummary = {
  member_name: string
  total_objects: number
  gain_percent: number
  estimated_salary: number
}
