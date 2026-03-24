'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Image as ImageIcon } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { SecondaryButton } from '@/components/ui/design-system'
import { listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem } from '@/lib/types/itemsFinance'

function money(value: number) {
  return `${value.toFixed(2)} $`
}

function roundDisplay(value: number) {
  return Math.round(value).toString()
}

function normalize(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function findPrice(items: CatalogItem[], label: string) {
  const found = findItemByAliases(items, [label])
  return Math.max(0, Number(found?.buy_price ?? 0) || 0)
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

function findPriceByAliases(items: CatalogItem[], aliases: string[]) {
  const found = findItemByAliases(items, aliases)
  return Math.max(0, Number(found?.buy_price ?? 0) || 0)
}

export default function DroguesBeneficePage() {
  const [seeds, setSeeds] = useState('100')
  const [seedPrice, setSeedPrice] = useState('0') // prix graine (unité)
  const [potPrice, setPotPrice] = useState('0')
  const [fertilizerPrice, setFertilizerPrice] = useState('0')
  const [waterPrice, setWaterPrice] = useState('0')
  const [lampPrice, setLampPrice] = useState('0')
  const [growZones, setGrowZones] = useState('1')
  const [brickTaxPercent, setBrickTaxPercent] = useState('5')
  const [brickTransformCost, setBrickTransformCost] = useState('0')
  const [pouchTransformCost, setPouchTransformCost] = useState('0')
  const [pouchSalePrice, setPouchSalePrice] = useState('0')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  const POUCHES_PER_BRICK = 10
  const POUCH_BATCH_SIZE = 10

  useEffect(() => {
    void listCatalogItemsUnified().then((rows) => {
      setItems(rows)
      setSeedPrice(String(findPrice(rows, 'Graine de coke')))
      setPotPrice(String(findPrice(rows, 'Pot')))
      setFertilizerPrice(String(findPrice(rows, 'Fertilisant')))
      setWaterPrice(String(findPriceByAliases(rows, ["Bouteille d'eau", 'Bouteille eau', 'Water bottle', 'Water', 'Eau'])))
      setLampPrice(String(findPrice(rows, 'Lampe')))
    }).catch(() => setItems([]))
  }, [])

  const calc = useMemo(() => {
    const seedQty = Math.max(0, Number(seeds) || 0)
    const unitSeedPrice = Math.max(0, Number(seedPrice) || 0)
    const unitPot = Math.max(0, Number(potPrice) || 0)
    const unitFertilizer = Math.max(0, Number(fertilizerPrice) || 0)
    const unitWater = Math.max(0, Number(waterPrice) || 0)
    const unitLamp = Math.max(0, Number(lampPrice) || 0)
    const zones = Math.max(1, Math.floor(Number(growZones) || 1))
    const leavesSeed = 1
    const taxPercent = Math.max(0, Number(brickTaxPercent) || 0)
    const taxRate = Math.min(100, taxPercent) / 100
    const brickCost = Math.max(0, Number(brickTransformCost) || 0)
    const pouchPerBrick = POUCHES_PER_BRICK
    const pouchCostPerBatch = Math.max(0, Number(pouchTransformCost) || 0)
    const pouchBatchSize = POUCH_BATCH_SIZE
    const unitSale = Math.max(0, Number(pouchSalePrice) || 0)

    const requiredPots = seedQty
    const requiredFertilizer = seedQty
    const requiredWater = seedQty * 3
    const lampsFromZones = zones * 2
    const requiredLamps = lampsFromZones

    const totalLeaves = seedQty * leavesSeed
    const grossBricks = totalLeaves
    const taxesOnBricks = grossBricks * taxRate
    const totalBricks = Math.max(0, grossBricks - taxesOnBricks)
    const totalPouches = totalBricks * pouchPerBrick

    const totalSeedCost = seedQty * unitSeedPrice
    const totalGrowCost = (requiredPots * unitPot) + (requiredFertilizer * unitFertilizer) + (requiredWater * unitWater) + (requiredLamps * unitLamp)
    const totalBrickCost = totalBricks * brickCost
    const totalPouchCost = (totalPouches / pouchBatchSize) * pouchCostPerBatch
    const totalCost = totalSeedCost + totalGrowCost + totalBrickCost + totalPouchCost
    const totalRevenue = totalPouches * unitSale
    const profit = totalRevenue - totalCost

    return {
      totalLeaves,
      grossBricks,
      taxesOnBricks,
      totalBricks,
      totalPouches,
      requiredPots,
      requiredFertilizer,
      requiredWater,
      requiredLamps,
      zones,
      lampsFromZones,
      totalSeedCost,
      totalGrowCost,
      totalBrickCost,
      totalPouchCost,
      pouchBatchSize,
      pouchCostPerBatch,
      totalCost,
      totalRevenue,
      profit,
    }
  }, [brickTaxPercent, brickTransformCost, fertilizerPrice, growZones, lampPrice, pouchSalePrice, pouchTransformCost, potPrice, seedPrice, seeds, waterPrice])

  const resourceCards = useMemo(() => ([
    { key: 'seed', label: 'Graine de coke', qty: calc.requiredPots, unit: Math.max(0, Number(seedPrice) || 0), aliases: ['Graine de coke', 'Graine coke'] },
    { key: 'pot', label: 'Pot', qty: calc.requiredPots, unit: Math.max(0, Number(potPrice) || 0), aliases: ['Pot'] },
    { key: 'fert', label: 'Fertilisant', qty: calc.requiredFertilizer, unit: Math.max(0, Number(fertilizerPrice) || 0), aliases: ['Fertilisant', 'Engrais'] },
    { key: 'water', label: "Bouteille d'eau", qty: calc.requiredWater, unit: Math.max(0, Number(waterPrice) || 0), aliases: ["Bouteille d'eau", 'Bouteille eau', 'Water bottle', 'Water', 'Eau'] },
    { key: 'lamp', label: 'Lampe', qty: calc.requiredLamps, unit: Math.max(0, Number(lampPrice) || 0), aliases: ['Lampe'] },
  ].map((entry) => ({
    ...entry,
    item: findItemByAliases(items, entry.aliases),
    subtotal: entry.qty * entry.unit,
  }))), [calc.requiredFertilizer, calc.requiredLamps, calc.requiredPots, calc.requiredWater, fertilizerPrice, items, lampPrice, potPrice, seedPrice, waterPrice])

  const globalTransformValue = useMemo(() => {
    const brickUnit = Math.max(0, Number(brickTransformCost) || 0)
    const pouchLot = Math.max(0, Number(pouchTransformCost) || 0)
    return brickUnit + pouchLot
  }, [brickTransformCost, pouchTransformCost])

  const setGlobalTransform = (value: string) => {
    const total = Math.max(0, Number(value) || 0)
    const split = total / 2
    setBrickTransformCost(String(split))
    setPouchTransformCost(String(split))
  }

  const totalTransformCost = calc.totalBrickCost + calc.totalPouchCost
  const seedItem = useMemo(() => findItemByAliases(items, ['Graine de coke', 'Graine coke']), [items])
  const pouchItem = useMemo(() => findItemByAliases(items, ['Pochon', 'Pochon de coke', 'Sachet', 'Pouch']), [items])

  return (
    <div className="space-y-4">
      <PageHeader title="Bénéfice drogue" subtitle="Simule ton coût total et ta marge par session" />
      <Panel>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3">
            <div className="mb-1 flex items-center gap-2">
              <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                {seedItem?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seedItem.image_url} alt="Nombre de graines" className="h-full w-full object-cover" loading="lazy" />
                ) : <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-3.5 w-3.5" /></div>}
              </div>
              <p className="text-xs text-cyan-100/85">Nombre de graines</p>
            </div>
            <Input value={seeds} onChange={(e) => setSeeds(e.target.value)} inputMode="decimal" />
            <p className="mb-1 mt-2 text-xs text-cyan-100/85">Prix graine (unité)</p>
            <Input value={seedPrice} onChange={(e) => setSeedPrice(e.target.value)} inputMode="decimal" />
          </div>
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3">
            <div className="mb-1 flex items-center gap-2">
              <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                {pouchItem?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pouchItem.image_url} alt="Prix vente pochon" className="h-full w-full object-cover" loading="lazy" />
                ) : <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-3.5 w-3.5" /></div>}
              </div>
              <p className="text-xs text-cyan-100/85">Prix vente pochon (unité)</p>
            </div>
            <Input value={pouchSalePrice} onChange={(e) => setPouchSalePrice(e.target.value)} inputMode="decimal" />
          </div>
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3">
            <p className="text-xs text-emerald-100/85">Pochons récupérés (auto)</p>
            <p className="mt-1 text-lg font-semibold">{roundDisplay(calc.totalPouches)}</p>
            <p className="text-[11px] text-emerald-100/75">Calculé depuis graines + taxe + pochons/brick.</p>
          </div>
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3">
            <p className="mb-1 text-xs text-cyan-100/85">Transfo global (brick + lot)</p>
            <Input value={String(globalTransformValue)} onChange={(e) => setGlobalTransform(e.target.value)} inputMode="decimal" />
            <p className="mt-1 text-[11px] text-cyan-100/75">Regroupe brick + lot. Pochons/brick = 10 (natif), lot pochon = 10 (natif).</p>
          </div>
        </div>

        <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="mb-3 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs text-white/90">
          Paramètres avancés
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {showAdvanced ? <div className="mb-3 space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Réglages détaillés</p>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-100/70">Production</p>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
                <p className="mb-1 text-xs text-cyan-100/85">Prix graine (unité)</p>
                <Input value={seedPrice} onChange={(e) => setSeedPrice(e.target.value)} inputMode="decimal" />
              </div>
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
                <p className="mb-1 text-xs text-cyan-100/85">Zones de culture</p>
                <Input value={growZones} onChange={(e) => setGrowZones(e.target.value)} inputMode="numeric" />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-100/70">Conversion</p>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">
                <p className="mb-1 text-xs text-emerald-100/85">Taxe brick (%)</p>
                <Input value={brickTaxPercent} onChange={(e) => setBrickTaxPercent(e.target.value)} inputMode="decimal" />
              </div>
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">
                <p className="mb-1 text-xs text-emerald-100/85">Pochons par brick (natif)</p>
                <p className="text-sm font-semibold">10</p>
              </div>
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">
                <p className="mb-1 text-xs text-emerald-100/85">Prix transfo brick (unité)</p>
                <Input value={brickTransformCost} onChange={(e) => setBrickTransformCost(e.target.value)} inputMode="decimal" />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-100/70">Conditionnement</p>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3">
                <p className="mb-1 text-xs text-amber-100/85">Prix transfo pochon (par lot)</p>
                <Input value={pouchTransformCost} onChange={(e) => setPouchTransformCost(e.target.value)} inputMode="decimal" />
              </div>
              <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3">
                <p className="mb-1 text-xs text-amber-100/85">Taille lot transfo pochon (natif)</p>
                <p className="text-sm font-semibold">10</p>
                <p className="mt-1 text-[11px] text-amber-100/70">Coût appliqué automatiquement tous les 10 pochons.</p>
              </div>
            </div>
          </div>
        </div> : null}

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">Ressources nécessaires</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-3 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
            <div className="mb-2 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] text-white/70">
                Z
              </div>
              <p className="text-sm font-medium">Zones de culture</p>
            </div>
            <p className="text-xs text-white/70">Besoin: <span className="rounded-md bg-cyan-500/15 px-1.5 py-0.5 font-semibold text-cyan-100">{calc.zones}</span></p>
          </div>
          {resourceCards.map((entry) => (
            <div key={entry.key} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-3 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                  {entry.item?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.item.image_url} alt={entry.label} className="h-full w-full object-cover" loading="lazy" />
                  ) : <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-3.5 w-3.5" /></div>}
                </div>
                <p className="text-sm font-medium">{entry.label}</p>
              </div>
              <p className="text-xs text-white/70">Besoin: <span className="rounded-md bg-cyan-500/15 px-1.5 py-0.5 font-semibold text-cyan-100">{entry.qty.toFixed(0)}</span></p>
              <p className="text-xs text-white/70">Sous-total: <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-100">{money(entry.subtotal)}</span></p>
            </div>
          ))}
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">Taxe brick (%): <span className="font-semibold">{Number(brickTaxPercent).toFixed(2)}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">Taxe brick (unités): <span className="font-semibold">{calc.taxesOnBricks.toFixed(2)}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">Pochons: <span className="font-semibold">{calc.totalPouches.toFixed(2)}</span></div>
        </div>

        <div className="mt-2 rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-cyan-500/15 to-sky-500/10 p-3 text-sm">
          <p className="text-xs text-cyan-100/85">Scénario 100 graines (ta règle)</p>
          <p className="font-semibold">100 feuilles ➜ 95 bricks (taxe 5%) ➜ 950 pochons</p>
          <p className="mt-1 text-xs text-cyan-100/80">Lampes: zones × 2 = {calc.zones} × 2 = {calc.requiredLamps}</p>
          <p className="mt-1 text-xs text-cyan-100/80">Transfo pochon appliquée par lot: {calc.pouchCostPerBatch.toFixed(2)} $ / {calc.pouchBatchSize.toFixed(0)} pochons</p>
        </div>

        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-white/60">Résumé financier</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm"><p className="text-xs text-amber-100/85">Coût graines</p><p className="font-semibold">{money(calc.totalSeedCost)}</p></div>
          <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm"><p className="text-xs text-amber-100/85">Coût pousse</p><p className="font-semibold">{money(calc.totalGrowCost)}</p></div>
          <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm"><p className="text-xs text-amber-100/85">Coût transfo brick</p><p className="font-semibold">{money(calc.totalBrickCost)}</p></div>
          <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm"><p className="text-xs text-amber-100/85">Coût transfo pochon</p><p className="font-semibold">{money(calc.totalPouchCost)}</p></div>
          <div className="rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm"><p className="text-xs text-rose-100/85">Coût total</p><p className="font-semibold">{money(calc.totalCost)}</p></div>
        </div>

        <div className="mt-2 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm">
          <p className="text-xs text-cyan-100/85">Coût transfo global appliqué</p>
          <p className="text-lg font-semibold">{money(totalTransformCost)}</p>
          <p className="text-[11px] text-cyan-100/75">Inclut la taxe brick ({brickTaxPercent}%) et la transfo pochon par lot.</p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm"><p className="text-xs text-cyan-100/85">Vente totale pochons</p><p className="text-lg font-semibold">{money(calc.totalRevenue)}</p></div>
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-sm"><p className="text-xs text-emerald-100/85">Bénéfice estimé</p><p className="text-lg font-semibold">{money(calc.profit)}</p></div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/drogues"><SecondaryButton>Accueil Drogues</SecondaryButton></Link>
          <Link href="/coke/cloturer"><SecondaryButton>Sessions Drogues</SecondaryButton></Link>
        </div>
      </Panel>
    </div>
  )
}
