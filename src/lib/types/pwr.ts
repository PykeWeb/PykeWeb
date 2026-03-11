export type PwrOrder = {
  id: string
  group_id: string
  title: string
  target_qty: number
  truck_capacity: number
  delivered_qty: number
  unit_label: string
  created_at: string
  updated_at: string
}

export type PwrOrderCheckpoint = {
  id: string
  order_id: string
  group_id: string
  delivered_qty: number
  note: string | null
  photo_url: string | null
  created_at: string
}
