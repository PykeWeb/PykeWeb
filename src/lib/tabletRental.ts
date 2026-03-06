export const TABLET_WEEKLY_PRICE = 5000
export const TABLET_PHONE = '820-2043'
export const TABLET_PREFIX = '[TABLETTE]'

export type TabletRentalStatus = 'open' | 'resolved'

export type TabletRentalPayload = {
  weeks: number
  amount: number
}

export type TabletRentalTicket = {
  id: string
  group_id: string
  group_name?: string | null
  group_badge?: string | null
  weeks: number
  amount: number
  image_url: string | null
  status: TabletRentalStatus
  created_at: string
}

export function normalizeWeeks(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 1
  return Math.max(1, Math.floor(parsed))
}

export function buildTabletMessage(payload: TabletRentalPayload) {
  return `${TABLET_PREFIX} ${JSON.stringify(payload)}`
}

export function parseTabletMessage(message: string): TabletRentalPayload | null {
  if (!message.startsWith(TABLET_PREFIX)) return null
  const raw = message.slice(TABLET_PREFIX.length).trim()
  try {
    const parsed = JSON.parse(raw) as Partial<TabletRentalPayload>
    const weeks = normalizeWeeks(parsed.weeks)
    const amount = Math.max(0, Number(parsed.amount || 0) || 0)
    return { weeks, amount }
  } catch {
    return null
  }
}
