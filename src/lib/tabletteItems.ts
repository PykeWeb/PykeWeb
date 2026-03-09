import type { TabletCatalogItemConfig } from '@/lib/types/tablette'

export const TABLET_DAILY_ITEM_OPTIONS: TabletCatalogItemConfig[] = [
  { key: 'disqueuse', name: 'Disqueuse', unit_price: 150, max_per_day: 2 },
  { key: 'kit_cambus', name: 'Kit de Cambus', unit_price: 50, max_per_day: 2 },
]

export const TABLET_TIMEZONE = 'Europe/Paris'

export function toDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TABLET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
