export type TabletCatalogItemKey = 'disqueuse' | 'kit_cambus'

export type TabletCatalogItemConfig = {
  key: TabletCatalogItemKey
  name: string
  unit_price: number
  max_per_day: number
  image_url?: string | null
}

export type TabletDailyRun = {
  id: string
  member_name: string
  day_key: string
  disqueuse_qty: number
  kit_cambus_qty: number
  total_items: number
  total_cost: number
  created_at: string
}

export type TabletSubmitPayload = {
  member_name: string
  disqueuse_qty: number
  kit_cambus_qty: number
}
