'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Coins, Image as ImageIcon, Leaf, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { createFinanceTransaction, listCatalogItemsUnified } from '@/lib/itemsApi'
import { markStockOutNote } from '@/lib/financeStockFlow'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import { buildCokeSessionPlan, COKE_SESSION_STORAGE_KEY, type CokeSessionPlan } from '@/lib/cokeSessionStorage'

function normalize(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function findItem(items: CatalogItem[], label: string) {
  return findItemByAliases(items, [label])
}

function findItemByAliases(items: CatalogItem[], aliases: string[]) {
  const normalizedAliases = aliases.map((alias) => normalize(alias))
  const scored = items.map((item) => {
    const name = normalize(item.name)
    let score = -1
    for (const alias of normalizedAliases) {
      if (name === alias) score = Math.max(score, 100)
      else if (name.startsWith(`${alias} `) || name.endsWith(` ${alias}`)) score = Math.max(score, 80)
      else if (alias.length >= 5 && name.includes(alias)) score = Math.max(score, 60)
    }
    return { item, score }
  })
  return scored.filter((row) => row.score >= 0).sort((a, b) => b.score - a.score)[0]?.item || null
}

function formatPrice(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${Math.round(value)} $`
}

function roundDisplay(value: number) {
  return Math.round(value).toString()
}

export default function CokeClosePage() {
  const router = useRouter()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [plan, setPlan] = useState<CokeSessionPlan | null>(null)
  const [saving, setSaving] = useState(false)

  const [realSeeds, setRealSeeds] = useState('0')
  const [realPots, setRealPots] = useState('0')
  const [realFertilizer, setRealFertilizer] = useState('0')
  const [realWater, setRealWater] = useState('0')
  const [realLamps, setRealLamps] = useState('0')
  const [realLeaves, setRealLeaves] = useState('0')
  const [pouchUnitSale, setPouchUnitSale] = useState('')
  const [plannedSeedsInput, setPlannedSeedsInput] = useState('0')
  const [plannedZonesInput, setPlannedZonesInput] = useState('1')
  const fallbackPlan = useMemo(() => buildCokeSessionPlan(100, 1), [])
  const activePlan = plan ?? fallbackPlan

  useEffect(() => {
    void listCatalogItemsUnified().then(setItems).catch(() => setItems([]))
    const raw = window.localStorage.getItem(COKE_SESSION_STORAGE_KEY)
    if (!raw) {
      setPlan(fallbackPlan)
      setRealSeeds(String(fallbackPlan.seeds))
      setRealPots(String(fallbackPlan.pots))
      setRealFertilizer(String(fallbackPlan.fertilizer))
      setRealWater(String(fallbackPlan.water))
      setRealLamps(String(fallbackPlan.lamps))
      setRealLeaves(String(fallbackPlan.theoreticalLeaves))
      setPlannedSeedsInput(String(fallbackPlan.seeds))
      setPlannedZonesInput(String(fallbackPlan.zones))
      window.localStorage.setItem(COKE_SESSION_STORAGE_KEY, JSON.stringify(fallbackPlan))
      return
    }
    try {
      const parsed = JSON.parse(raw) as CokeSessionPlan
      setPlan(parsed)
      setRealSeeds(String(parsed.seeds))
      setRealPots(String(parsed.pots))
      setRealFertilizer(String(parsed.fertilizer))
      setRealWater(String(parsed.water))
      setRealLamps(String(parsed.lamps))
      setRealLeaves(String(parsed.theoreticalLeaves))
      setPlannedSeedsInput(String(parsed.seeds))
      setPlannedZonesInput(String(parsed.zones))
    } catch {
      setPlan(fallbackPlan)
    }
  }, [fallbackPlan])

  const applyPlan = (nextPlan: CokeSessionPlan, syncReal = true) => {
    setPlan(nextPlan)
    setPlannedSeedsInput(String(nextPlan.seeds))
    setPlannedZonesInput(String(nextPlan.zones))
    if (syncReal) {
      setRealSeeds(String(nextPlan.seeds))
      setRealPots(String(nextPlan.pots))
      setRealFertilizer(String(nextPlan.fertilizer))
      setRealWater(String(nextPlan.water))
      setRealLamps(String(nextPlan.lamps))
      setRealLeaves(String(nextPlan.theoreticalLeaves))
    }
    window.localStorage.setItem(COKE_SESSION_STORAGE_KEY, JSON.stringify(nextPlan))
  }

  const refreshPlanFromInputs = () => {
    const refreshedPlan = buildCokeSessionPlan(Number(plannedSeedsInput), Number(plannedZonesInput))
    applyPlan(refreshedPlan, true)
  }

  useEffect(() => {
    refreshPlanFromInputs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannedSeedsInput, plannedZonesInput])

  const rows = useMemo(() => {
    const real = {
      seeds: Math.max(0, Math.floor(Number(realSeeds) || 0)),
      pots: Math.max(0, Math.floor(Number(realPots) || 0)),
      fertilizer: Math.max(0, Math.floor(Number(realFertilizer) || 0)),
      water: Math.max(0, Math.floor(Number(realWater) || 0)),
      lamps: Math.max(0, Math.floor(Number(realLamps) || 0)),
      leaves: Math.max(0, Math.floor(Number(realLeaves) || 0)),
    }
    return [
      { key: 'seeds', label: 'Graines', planned: activePlan.seeds, real: real.seeds },
      { key: 'pots', label: 'Pots', planned: activePlan.pots, real: real.pots },
      { key: 'fert', label: 'Fertilisant', planned: activePlan.fertilizer, real: real.fertilizer },
      { key: 'water', label: 'Eau', planned: activePlan.water, real: real.water },
      { key: 'lamps', label: 'Lampes', planned: activePlan.lamps, real: real.lamps },
      { key: 'leaves', label: 'Feuilles', planned: activePlan.theoreticalLeaves, real: real.leaves },
    ]
  }, [activePlan, realFertilizer, realLamps, realLeaves, realPots, realSeeds, realWater])

  async function submit() {
    if (!plan) {
      toast.error('Aucune session préparée à clôturer.')
      return
    }
    setSaving(true)
    try {
      const consumables = [
        { label: 'Graine de coke', quantity: Math.max(0, Math.floor(Number(realSeeds) || 0)) },
        { label: 'Pot', quantity: Math.max(0, Math.floor(Number(realPots) || 0)) },
        { label: 'Fertilisant', quantity: Math.max(0, Math.floor(Number(realFertilizer) || 0)) },
        { label: "Bouteille d'eau", quantity: Math.max(0, Math.floor(Number(realWater) || 0)) },
        { label: 'Lampe', quantity: Math.max(0, Math.floor(Number(realLamps) || 0)) },
      ]
      const partialRows: string[] = []

      for (const row of consumables) {
        if (row.quantity <= 0) continue
        const item = getConsumableItem(row.label)
        if (!item) {
          partialRows.push(`${row.label}: item introuvable`)
          continue
        }
        const available = Math.max(0, Math.floor(Number(item.stock) || 0))
        const quantityToSell = Math.min(row.quantity, available)
        if (quantityToSell <= 0) {
          partialRows.push(`${row.label}: stock vide`)
          continue
        }
        if (quantityToSell < row.quantity) {
          partialRows.push(`${row.label}: ${quantityToSell}/${row.quantity}`)
        }
        await createFinanceTransaction({
          item_id: item.id,
          mode: 'sell',
          quantity: quantityToSell,
          unit_price: 0,
          counterparty: 'Session coke',
          notes: markStockOutNote('Clôture session coke'),
          payment_mode: 'other',
        })
      }

      const outputItem = findItem(items, 'Feuille de Cocaïne')
      const leavesQty = Math.max(0, Math.floor(Number(realLeaves) || 0))
      if (outputItem && leavesQty > 0) {
        await createFinanceTransaction({
          item_id: outputItem.id,
          mode: 'buy',
          quantity: leavesQty,
          unit_price: 0,
          counterparty: 'Session coke',
          notes: 'Clôture session coke',
          payment_mode: 'other',
        })
      } else if (!outputItem && leavesQty > 0) {
        toast.error("Item introuvable: Feuille de Cocaïne")
      }

      window.localStorage.removeItem(COKE_SESSION_STORAGE_KEY)
      if (partialRows.length > 0) {
        toast.warning(`Clôture partielle (stock ajusté): ${partialRows.join(' • ')}`)
      }
      toast.success('Session coke clôturée et stock mis à jour.')
      router.push('/items?view=tools')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue pendant la validation.'
      toast.error(`Impossible de valider la session: ${message}`)
    } finally {
      setSaving(false)
    }
  }

  const closeFields = [
    { label: 'Graines réellement utilisées', value: realSeeds, set: setRealSeeds, itemLabel: 'Graine de coke' },
    { label: 'Pots utilisés', value: realPots, set: setRealPots, itemLabel: 'Pot' },
    { label: 'Fertilisant utilisé', value: realFertilizer, set: setRealFertilizer, itemLabel: 'Fertilisant' },
    { label: 'Eau utilisée', value: realWater, set: setRealWater, itemLabel: "Bouteille d'eau" },
    { label: 'Lampes utilisées / perdues', value: realLamps, set: setRealLamps, itemLabel: 'Lampe' },
    { label: 'Feuilles récupérées', value: realLeaves, set: setRealLeaves, itemLabel: 'Feuille de Cocaïne' },
  ]

  const getItemForField = useCallback((label: string) => (
    label === "Bouteille d'eau"
      ? findItemByAliases(items, ["Bouteille d'eau", 'Bouteille eau', 'Water bottle', 'Water'])
      : findItem(items, label)
  ), [items])

  const getConsumableItem = useCallback((label: string) => (
    label === "Bouteille d'eau"
      ? findItemByAliases(items, ["Bouteille d'eau", 'Bouteille eau', 'Water bottle', 'Water'])
      : findItem(items, label)
  ), [items])
  const pouchItem = useMemo(() => findItemByAliases(items, ['Pochon', 'Pochon de coke', 'Sachet', 'Pouch']), [items])

  useEffect(() => {
    if (pouchUnitSale) return
    const catalogPouchPrice = Number(pouchItem?.sell_price ?? pouchItem?.buy_price ?? 70)
    const initial = Number.isFinite(catalogPouchPrice) && catalogPouchPrice > 0 ? catalogPouchPrice : 70
    setPouchUnitSale(String(Math.round(initial)))
  }, [pouchItem, pouchUnitSale])

  const sessionTotals = useMemo(() => {
    const consumables = [
      { label: 'Graine de coke', quantity: Math.max(0, Math.floor(Number(realSeeds) || 0)) },
      { label: 'Pot', quantity: Math.max(0, Math.floor(Number(realPots) || 0)) },
      { label: 'Fertilisant', quantity: Math.max(0, Math.floor(Number(realFertilizer) || 0)) },
      { label: "Bouteille d'eau", quantity: Math.max(0, Math.floor(Number(realWater) || 0)) },
      { label: 'Lampe', quantity: Math.max(0, Math.floor(Number(realLamps) || 0)) },
    ]
    const leavesQty = Math.max(0, Math.floor(Number(realLeaves) || 0))
    const seedRow = consumables.find((row) => row.label === 'Graine de coke')
    const seedItem = getConsumableItem('Graine de coke')
    const seedUnitPrice = Number(seedItem?.buy_price ?? 0)
    const seedCost = (seedRow?.quantity ?? 0) * (Number.isFinite(seedUnitPrice) ? seedUnitPrice : 0)
    const equipmentCost = consumables
      .filter((row) => row.label !== 'Graine de coke')
      .reduce((sum, row) => {
        const item = getConsumableItem(row.label)
        const pu = Number(item?.buy_price ?? 0)
        return sum + row.quantity * (Number.isFinite(pu) ? pu : 0)
      }, 0)
    const totalConsumablesCost = seedCost + equipmentCost

    const pouchPerBrick = 10
    const brickTaxRate = 0.05
    const leafToBrickUnit = 150
    const brickToPouchUnit = 150
    const totalBricksAfterTax = Math.max(0, leavesQty - (leavesQty * brickTaxRate))
    const totalPouches = totalBricksAfterTax * pouchPerBrick
    const leafToBrickTransformCost = totalBricksAfterTax * leafToBrickUnit
    const brickToPouchTransformCost = (totalPouches / pouchPerBrick) * brickToPouchUnit
    const transformCost = leafToBrickTransformCost + brickToPouchTransformCost
    const rawPouchUnitPrice = Number(pouchUnitSale)
    const pouchUnitPrice = Number.isFinite(rawPouchUnitPrice) && rawPouchUnitPrice > 0 ? rawPouchUnitPrice : 70
    const outputValue = totalPouches * pouchUnitPrice
    const estimatedProfitRecovered = outputValue - totalConsumablesCost - transformCost
    return { totalConsumablesCost, seedCost, equipmentCost, outputValue, estimatedProfitRecovered, totalPouches, pouchUnitPrice, transformCost, leafToBrickTransformCost, brickToPouchTransformCost }
  }, [getConsumableItem, pouchUnitSale, realFertilizer, realLamps, realLeaves, realPots, realSeeds, realWater])

  const plannedResources = useMemo(() => {
    return [
      { key: 'seed', label: 'Graine de coke', needed: activePlan.seeds, realValue: realSeeds, setReal: setRealSeeds },
      { key: 'pot', label: 'Pot', needed: activePlan.pots, realValue: realPots, setReal: setRealPots },
      { key: 'fert', label: 'Fertilisant', needed: activePlan.fertilizer, realValue: realFertilizer, setReal: setRealFertilizer },
      { key: 'water', label: "Bouteille d'eau", needed: activePlan.water, realValue: realWater, setReal: setRealWater },
      { key: 'lamp', label: 'Lampe', needed: activePlan.lamps, realValue: realLamps, setReal: setRealLamps },
      { key: 'leaf', label: 'Feuille de Cocaïne', needed: activePlan.theoreticalLeaves, realValue: realLeaves, setReal: setRealLeaves },
    ].map((entry) => {
      const item = entry.label === "Bouteille d'eau"
        ? findItemByAliases(items, ["Bouteille d'eau", 'Bouteille eau', 'Water bottle', 'Water'])
        : findItem(items, entry.label)
      const stock = Math.max(0, Number(item?.stock || 0))
      const missing = Math.max(0, entry.needed - stock)
      const pu = Number(item?.buy_price ?? 0)
      return { ...entry, item, stock, missing, pu, missingCost: missing * pu }
    })
  }, [activePlan, items, realFertilizer, realLamps, realLeaves, realPots, realSeeds, realWater])

  const plannedEquipmentCost = useMemo(() => (
    plannedResources
      .filter((r) => ['pot', 'fert', 'water', 'lamp'].includes(r.key))
      .reduce((sum, r) => sum + (r.needed * r.pu), 0)
  ), [plannedResources])

  const seedItem = useMemo(() => findItem(items, 'Graine de coke'), [items])
  const zoneItem = useMemo(() => findItem(items, 'Lampe'), [items])
  const leafItem = useMemo(() => findItemByAliases(items, ['Feuille de Cocaïne', 'Feuille de coke', 'Feuille cocaïne']), [items])

  return (
    <div className="space-y-4">
      <Panel>
        <div className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-2">
                <div className="mb-1 flex items-center gap-2">
                  <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                    {seedItem?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={seedItem.image_url} alt="Graines prévues" className="h-full w-full object-cover" loading="lazy" />
                    ) : <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-3.5 w-3.5" /></div>}
                  </div>
                  <p className="text-xs text-cyan-100/85">Graines prévues</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPlannedSeedsInput(String(Math.max(0, (Number(plannedSeedsInput) || 0) - 100)))}
                    className="h-9 w-9 rounded-lg border border-white/15 bg-white/[0.04] text-lg"
                    aria-label="Retirer 100 graines"
                  >
                    -
                  </button>
                  <Input value={plannedSeedsInput} onChange={(e) => setPlannedSeedsInput(e.target.value)} inputMode="numeric" className="h-9 rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setPlannedSeedsInput(String((Number(plannedSeedsInput) || 0) + 100))}
                    className="h-9 w-9 rounded-lg border border-white/15 bg-white/[0.04] text-lg"
                    aria-label="Ajouter 100 graines"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-2">
                <div className="mb-1 flex items-center gap-2">
                  <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                    {zoneItem?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={zoneItem.image_url} alt="Zones prévues" className="h-full w-full object-cover" loading="lazy" />
                    ) : <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-3.5 w-3.5" /></div>}
                  </div>
                  <p className="text-xs text-cyan-100/85">Zones prévues</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPlannedZonesInput(String(Math.max(1, (Number(plannedZonesInput) || 1) - 1)))}
                    className="h-9 w-9 rounded-lg border border-white/15 bg-white/[0.04] text-lg"
                    aria-label="Retirer 1 zone"
                  >
                    -
                  </button>
                  <Input value={plannedZonesInput} onChange={(e) => setPlannedZonesInput(e.target.value)} inputMode="numeric" className="h-9 rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setPlannedZonesInput(String((Number(plannedZonesInput) || 0) + 1))}
                    className="h-9 w-9 rounded-lg border border-white/15 bg-white/[0.04] text-lg"
                    aria-label="Ajouter 1 zone"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="group relative rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
                    {leafItem?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={leafItem.image_url} alt="Feuille de Cocaïne" className="h-full w-full object-cover" loading="lazy" />
                    ) : <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-3.5 w-3.5" /></div>}
                  </div>
                  <p className="text-xs text-emerald-100/85">Feuille de Cocaïne</p>
                </div>
                <div className="mt-1 flex h-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04]">
                  <p className="text-lg font-semibold">{roundDisplay(activePlan.theoreticalLeaves)}</p>
                </div>
                <div className="pointer-events-none absolute left-2 top-full z-10 mt-1 hidden rounded-md border border-white/15 bg-slate-900/95 px-2 py-1 text-[11px] text-emerald-100 shadow-lg group-hover:block">
                  Production théorique session
                </div>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {plannedResources.map((field) => {
                return (
                  <div key={field.label} className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                        {field.item?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={field.item.image_url} alt={field.label} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-3.5 w-3.5" /></div>
                        )}
                      </div>
                      <p className="text-xs text-white/75">{field.label}</p>
                    </div>
                    <div className="mb-2 grid grid-cols-2 gap-1 text-xs">
                      <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">Besoin <span className="float-right font-semibold">{field.needed}</span></div>
                      <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">Stock <span className="float-right font-semibold">{field.stock}</span></div>
                      <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">Manque <span className={`float-right font-semibold ${field.missing > 0 ? 'text-rose-200' : 'text-emerald-200'}`}>{field.missing}</span></div>
                      <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">PU <span className="float-right font-semibold">{formatPrice(field.pu)}</span></div>
                      <div className="col-span-2 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">Coût manque <span className="float-right font-semibold">{formatPrice(field.missingCost)}</span></div>
                    </div>
                    <p className="mb-1 text-[11px] text-white/60">Quantité réelle (modifiable)</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => field.setReal(String(Math.max(0, (Number(field.realValue) || 0) - 1)))}
                        className="h-9 w-9 rounded-lg border border-white/15 bg-white/[0.04] text-lg"
                        aria-label={`Retirer 1 ${field.label}`}
                      >
                        -
                      </button>
                      <Input value={field.realValue} onChange={(e) => field.setReal(e.target.value)} inputMode="numeric" className="h-9 rounded-lg" />
                      <button
                        type="button"
                        onClick={() => field.setReal(String((Number(field.realValue) || 0) + 1))}
                        className="h-9 w-9 rounded-lg border border-white/15 bg-white/[0.04] text-lg"
                        aria-label={`Ajouter 1 ${field.label}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-white/70"><tr><th className="px-2 py-2 text-left">Ressource</th><th className="px-2 py-2 text-right">Prévu</th><th className="px-2 py-2 text-right">Réel</th><th className="px-2 py-2 text-right">Écart</th></tr></thead>
                <tbody className="divide-y divide-white/10">
                  {rows.map((row) => {
                    const delta = row.real - row.planned
                    return <tr key={row.key} className={delta < 0 ? 'bg-rose-500/[0.07]' : 'bg-emerald-500/[0.05]'}><td className="px-2 py-1.5">{row.label}</td><td className="px-2 py-1.5 text-right">{row.planned}</td><td className="px-2 py-1.5 text-right">{row.real}</td><td className={`px-2 py-1.5 text-right font-semibold ${delta < 0 ? 'text-rose-200' : 'text-emerald-200'}`}>{delta > 0 ? '+' : ''}{delta}</td></tr>
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm">
                <p className="flex items-center gap-1.5 text-xs text-amber-100/85"><Wallet className="h-3.5 w-3.5" /> Total prix équipement prévu</p>
                <p className="mt-2 text-center text-lg font-semibold leading-none">{formatPrice(plannedEquipmentCost)}</p>
              </div>
              <div className="group relative rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
                    {pouchItem?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pouchItem.image_url} alt="Pochons récupérés" className="h-full w-full object-cover" loading="lazy" />
                    ) : <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-3.5 w-3.5" /></div>}
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-cyan-100/85"><Coins className="h-3.5 w-3.5" /> Valeur des pochons récupérés</p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-2xl font-semibold leading-none tracking-tight">{formatPrice(sessionTotals.outputValue)}</p>
                  <div className="inline-flex w-auto shrink-0 items-center gap-1.5 rounded-xl border border-cyan-300/30 bg-cyan-500/12 px-2.5 py-1.5 shadow-[0_0_12px_rgba(34,211,238,0.12)]">
                    <span className="text-[11px] font-semibold text-cyan-100/85">PU</span>
                    <button type="button" onClick={() => setPouchUnitSale(String(Math.max(1, (Number(pouchUnitSale) || 0) - 5)))} className="grid h-5 w-5 place-items-center rounded-md border border-white/15 bg-white/[0.06] pb-[1px] text-[10px] text-white/85">-</button>
                    <input value={pouchUnitSale} onChange={(e) => setPouchUnitSale(e.target.value)} inputMode="numeric" className="h-7 w-16 rounded-md border border-white/15 bg-white/[0.06] px-1 text-center text-xs font-semibold text-cyan-50 outline-none focus:border-cyan-200/40" />
                    <button type="button" onClick={() => setPouchUnitSale(String((Number(pouchUnitSale) || 0) + 5))} className="grid h-5 w-5 place-items-center rounded-md border border-white/15 bg-white/[0.06] pb-[1px] text-[10px] text-white/85">+</button>
                    <span className="text-[11px] text-cyan-100/75">$</span>
                  </div>
                </div>
                <div className="pointer-events-none absolute left-2 top-full z-10 mt-1 hidden rounded-md border border-white/15 bg-slate-900/95 px-2 py-1 text-[11px] text-cyan-100 shadow-lg group-hover:block">
                  PU estimé pochon: {formatPrice(sessionTotals.pouchUnitPrice)}<br />
                  Pochons récupérés (taxe 5%): {roundDisplay(sessionTotals.totalPouches)}
                </div>
              </div>
              <div className="group relative rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-sm">
                <p className="flex items-center gap-1.5 text-xs text-emerald-100/85"><Leaf className="h-3.5 w-3.5" /> Valeur estimée de bénéfice récupéré</p>
                <p className="mt-2 text-center text-lg font-semibold leading-none">{formatPrice(sessionTotals.estimatedProfitRecovered)}</p>
                <div className="pointer-events-none absolute left-2 top-full z-10 mt-1 hidden rounded-md border border-white/15 bg-slate-900/95 px-2 py-1 text-[11px] text-emerald-100 shadow-lg group-hover:block">
                  Vente pochons estimée ({formatPrice(sessionTotals.outputValue)}) - graines ({formatPrice(sessionTotals.seedCost)}) - équipements ({formatPrice(sessionTotals.equipmentCost)}) - transfo feuille→brick ({formatPrice(sessionTotals.leafToBrickTransformCost)}) - transfo brick→pochon ({formatPrice(sessionTotals.brickToPouchTransformCost)})
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <PrimaryButton disabled={saving} onClick={() => { void submit() }}>{saving ? 'Validation...' : 'Session faite (mettre à jour stock)'}</PrimaryButton>
              <Link href="/drogues"><SecondaryButton>Retour</SecondaryButton></Link>
              <Link href="/drogues/benefice"><SecondaryButton>Bénéfice drogue</SecondaryButton></Link>
            </div>
          </div>
      </Panel>
    </div>
  )
}
