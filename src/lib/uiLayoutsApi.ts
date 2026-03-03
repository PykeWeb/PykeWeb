export async function getLayoutOrder(pageKey: string) {
  const res = await fetch(`/api/ui-layouts?page_key=${encodeURIComponent(pageKey)}`, { cache: 'no-store' })
  if (!res.ok) return [] as string[]
  const data = await res.json()
  return Array.isArray(data.order) ? data.order : []
}

export async function saveLayoutOrder(pageKey: string, order: string[], scopeType: 'global' | 'group') {
  await fetch('/api/ui-layouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_key: pageKey, order, scope_type: scopeType }),
  })
}

export async function resetLayoutOrder(pageKey: string, scopeType: 'global' | 'group') {
  await fetch('/api/ui-layouts', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_key: pageKey, scope_type: scopeType }),
  })
}
