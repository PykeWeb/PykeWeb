import type { TabletCatalogItemConfig } from '@/lib/types/tablette'

export const TABLET_DAILY_ITEM_OPTIONS: TabletCatalogItemConfig[] = [
  { key: 'disqueuse', name: 'Disqueuse', unit_price: 150, max_per_day: 2, image_url: '/images/tablette/image-2.svg' },
  { key: 'kit_cambus', name: 'Kit de Cambriolage', unit_price: 50, max_per_day: 2, image_url: '/images/tablette/image-1.svg' },
]

export const TABLET_TIMEZONE = 'Europe/Paris'

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TABLET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatHour(date: Date): number {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TABLET_TIMEZONE,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
  return Number.isFinite(hour) ? hour : 0
}

export function toDayKey(date = new Date()): string {
  // Reset window starts every day at 08:00 (Paris time), not midnight.
  const parisHour = formatHour(date)
  if (parisHour >= 8) return formatDay(date)
  const previousDay = new Date(date.getTime() - 24 * 60 * 60 * 1000)
  return formatDay(previousDay)
}

export function normalizeTabletOptions(options: TabletCatalogItemConfig[] | null | undefined): TabletCatalogItemConfig[] {
  const rows = Array.isArray(options) ? options : []
  const cleaned = rows
    .map((row, index) => ({
      key: String(row.key || '').trim(),
      name: String(row.name || '').trim(),
      unit_price: Math.max(0, Number(row.unit_price) || 0),
      max_per_day: Math.max(0, Math.min(100, Math.floor(Number(row.max_per_day) || 0))),
      image_url: row.image_url || null,
      sort_order: index,
    }))
    .filter((row) => row.key.length > 0 && row.name.length > 0)

  if (cleaned.length > 0) {
    return cleaned.sort((a, b) => a.sort_order - b.sort_order).map(({ sort_order, ...row }) => row)
  }

  return TABLET_DAILY_ITEM_OPTIONS
}
