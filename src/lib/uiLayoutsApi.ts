export async function getLayoutOrder(pageKey: string, scopeType?: 'global' | 'group', scopeId?: string) {
  const params = new URLSearchParams({ page_key: pageKey })
  if (scopeType) params.set('scope_type', scopeType)
  if (scopeId) params.set('scope_id', scopeId)
  const res = await fetch(`/api/ui-layouts?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) return [] as string[]
  const data = await res.json()
  return Array.isArray(data.order) ? data.order : []
}

export async function saveLayoutOrder(pageKey: string, order: string[], scopeType: 'global' | 'group', scopeId?: string) {
  await fetch('/api/ui-layouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_key: pageKey, order, scope_type: scopeType, scope_id: scopeId || null }),
  })
}

export async function resetLayoutOrder(pageKey: string, scopeType: 'global' | 'group', scopeId?: string) {
  await fetch('/api/ui-layouts', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_key: pageKey, scope_type: scopeType, scope_id: scopeId || null }),
  })
}
