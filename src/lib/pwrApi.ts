import { withTenantSessionHeader } from '@/lib/tenantRequest'
import type { PwrOrder, PwrOrderCheckpoint } from '@/lib/types/pwr'

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

async function parseOrThrow<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => ({})) as { error?: string }
  if (!res.ok) throw new Error(data.error || fallback)
  return data as T
}

export async function listPwrOrders() {
  const res = await fetch('/api/pwr/orders', withTenantSessionHeader({ cache: 'no-store' }))
  return parseOrThrow<PwrOrder[]>(res, 'Impossible de charger les commandes PWR.')
}

export async function createPwrOrder(payload: { title: string; targetQty: number; truckCapacity: number; unitLabel?: string }) {
  const res = await fetch('/api/pwr/orders', {
    method: 'POST',
    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
    body: JSON.stringify(payload),
  })
  return parseOrThrow<PwrOrder>(res, 'Impossible de créer la commande PWR.')
}

export async function listPwrCheckpoints(orderId: string) {
  const res = await fetch(`/api/pwr/orders/${orderId}/checkpoints`, withTenantSessionHeader({ cache: 'no-store' }))
  return parseOrThrow<PwrOrderCheckpoint[]>(res, 'Impossible de charger les points de suivi.')
}

export async function createPwrCheckpoint(payload: { orderId: string; deliveredQty: number; note: string; photo?: File | null }) {
  const form = new FormData()
  form.set('deliveredQty', String(payload.deliveredQty))
  form.set('note', payload.note)
  if (payload.photo) form.set('photo', payload.photo)

  const res = await fetch(`/api/pwr/orders/${payload.orderId}/checkpoints`, {
    method: 'POST',
    ...withTenantSessionHeader(),
    body: form,
  })

  return parseOrThrow<PwrOrderCheckpoint>(res, 'Impossible d\'ajouter le point de suivi.')
}

export { toErrorMessage }
