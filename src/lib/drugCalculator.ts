export type DrugCalcMode = 'coke' | 'meth'

export type DrugCalcRequirement = {
  label: string
  qty: number
  unitPrice: number | null
  subtotal: number | null
}

export type DrugCalcResult = {
  requirements: DrugCalcRequirement[]
  totalKnown: number
  hasMissingPrices: boolean
  missingPrices: string[]
}

type PricedItem = { name: string; price: number | null | undefined }

function findPriceByKeywords(items: PricedItem[], keywords: string[]): number | null {
  const normalized = keywords.map((k) => k.toLowerCase())
  const match = items.find((item) => {
    const name = (item.name || '').toLowerCase()
    return normalized.some((kw) => name.includes(kw))
  })
  if (!match) return null
  const price = Number(match.price)
  return Number.isFinite(price) && price > 0 ? price : null
}

function normalizeRequirements(requirements: Array<{ label: string; qty: number; unitPrice: number | null }>): DrugCalcResult {
  const normalized = requirements.map((req) => ({
    label: req.label,
    qty: Math.max(1, Math.floor(req.qty || 1)),
    unitPrice: req.unitPrice,
    subtotal: req.unitPrice === null ? null : req.qty * req.unitPrice,
  }))
  const missingPrices = normalized.filter((req) => req.unitPrice === null).map((req) => req.label)
  const totalKnown = normalized.reduce((sum, req) => sum + (req.subtotal ?? 0), 0)
  return { requirements: normalized, totalKnown, hasMissingPrices: missingPrices.length > 0, missingPrices }
}

export function buildDrugCalculatorResult(mode: DrugCalcMode, quantity: number, items: PricedItem[]): DrugCalcResult {
  const qty = Math.max(1, Math.floor(quantity || 1))

  if (mode === 'coke') {
    return normalizeRequirements([
      { label: 'Pots', qty, unitPrice: 10 },
      { label: 'Fertilisant', qty, unitPrice: 10 },
      { label: 'Lampes', qty: Math.ceil(qty / 9), unitPrice: 36 },
      { label: "Bouteille d'eau", qty: qty * 3, unitPrice: findPriceByKeywords(items, ["bouteille d'eau", 'eau', 'water']) },
    ])
  }

  return normalizeRequirements([
    { label: 'Tables', qty, unitPrice: findPriceByKeywords(items, ['table']) },
    { label: 'Machine de Meth', qty, unitPrice: findPriceByKeywords(items, ['machine de meth', 'meth']) },
    { label: 'Batteries', qty: qty * 2, unitPrice: findPriceByKeywords(items, ['batterie', 'battery']) },
    { label: 'Ammoniaque', qty: qty * 16, unitPrice: findPriceByKeywords(items, ['ammoniaque']) },
    { label: 'Methylamine', qty: qty * 15, unitPrice: findPriceByKeywords(items, ['methylamine']) },
  ])
}
