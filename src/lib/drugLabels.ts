export function toDrugShortLabel(rawType: string | null | undefined) {
  const value = String(rawType || '').toLowerCase()
  if (value.includes('meth')) return 'Meth'
  if (value.includes('coke')) return 'Coke'
  return (String(rawType || '').split('(')[0] || 'Autres').trim() || 'Autres'
}
