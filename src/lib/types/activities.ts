export type ActivityType = 'Cambriolage' | 'Conteneur' | 'ATM' | 'Superette' | 'Boite au lettre'

export const ACTIVITY_OPTIONS: ActivityType[] = ['Cambriolage', 'Conteneur', 'ATM', 'Superette', 'Boite au lettre']

export type ActivityEntry = {
  id: string
  group_id: string
  member_name: string
  activity_type: ActivityType
  object_item_id: string
  object_name: string
  object_unit_price: number
  quantity: number
  percent_per_object: number
  salary_amount: number
  equipment_item_id: string | null
  equipment_name: string | null
  proof_image_data: string
  created_at: string
}

export type ActivitySettings = {
  group_id: string
  default_percent_per_object: number
}

export type ActivityMemberSummary = {
  member_name: string
  total_objects: number
  total_salary: number
}
