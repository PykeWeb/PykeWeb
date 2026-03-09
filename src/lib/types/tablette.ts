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

export type TabletDailyAggregate = {
  day_key: string
  runs: number
  total_items: number
  total_cost: number
  unique_members: number
}

export type TabletWeeklyAggregate = {
  week_key: string
  runs: number
  total_items: number
  total_cost: number
  unique_members: number
}

export type TabletMemberAggregate = {
  member_name: string
  total_runs: number
  total_items: number
  total_cost: number
  last_day_key: string
  did_today: boolean
}

export type TabletGroupTodayStatus = {
  group_id: string
  group_name: string
  runs_today: number
  items_today: number
  unique_members_today: number
}

export type AdminTabletAtelierStatsResponse = {
  today: string
  totals: {
    runs_today: number
    items_today: number
    cost_today: number
    runs_week: number
    items_week: number
    cost_week: number
  }
  by_day: TabletDailyAggregate[]
  by_week: TabletWeeklyAggregate[]
  by_member: TabletMemberAggregate[]
  by_group_today: TabletGroupTodayStatus[]
}

