'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { SecondaryButton } from '@/components/ui/design-system'
import { listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem } from '@/lib/types/itemsFinance'

function money(value: number) {
  return `${value.toFixed(2)} $`
}

function normalize(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function findPrice(items: CatalogItem[], label: string) {
  const n = normalize(label)
  const found = items.find((item) => {
    const name = normalize(item.name)
    return name === n || name.includes(n) || n.includes(name)
  })
  return Math.max(0, Number(found?.buy_price ?? 0) || 0)
}

export default function DroguesBeneficePage() {
  const [seeds, setSeeds] = useState('100')
  const [seedPrice, setSeedPrice] = useState('0') // prix graine (unité)
  const [potPrice, setPotPrice] = useState('0')
  const [fertilizerPrice, setFertilizerPrice] = useState('0')
  const [waterPrice, setWaterPrice] = useState('0')
  const [lampPrice, setLampPrice] = useState('0')
  const [leavesPerSeed, setLeavesPerSeed] = useState('1')
  const [brickTaxPercent, setBrickTaxPercent] = useState('5')
  const [pouchesPerBrick, setPouchesPerBrick] = useState('10')
  const [brickTransformCost, setBrickTransformCost] = useState('0')
  const [pouchTransformCost, setPouchTransformCost] = useState('0')
  const [pouchSalePrice, setPouchSalePrice] = useState('0')
  const [items, setItems] = useState<CatalogItem[]>([])

  useEffect(() => {
    void listCatalogItemsUnified().then((rows) => {
      setItems(rows)
      setSeedPrice(String(findPrice(rows, 'Graine de coke')))
      setPotPrice(String(findPrice(rows, 'Pot')))
      setFertilizerPrice(String(findPrice(rows, 'Fertilisant')))
      setWaterPrice(String(findPrice(rows, "Bouteille d'eau") || findPrice(rows, 'Eau')))
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
    const leavesSeed = Math.max(0.0001, Number(leavesPerSeed) || 1)
    const taxPercent = Math.max(0, Number(brickTaxPercent) || 0)
    const taxRate = Math.min(100, taxPercent) / 100
    const brickCost = Math.max(0, Number(brickTransformCost) || 0)
    const pouchPerBrick = Math.max(0, Number(pouchesPerBrick) || 0)
    const pouchCost = Math.max(0, Number(pouchTransformCost) || 0)
    const unitSale = Math.max(0, Number(pouchSalePrice) || 0)

    const requiredPots = seedQty
    const requiredFertilizer = seedQty
    const requiredWater = seedQty * 3
    const requiredLamps = Math.ceil(seedQty / 9)

    const totalLeaves = seedQty * leavesSeed
    const grossBricks = totalLeaves
    const taxesOnBricks = grossBricks * taxRate
    const totalBricks = Math.max(0, grossBricks - taxesOnBricks)
    const totalPouches = totalBricks * pouchPerBrick

    const totalSeedCost = seedQty * unitSeedPrice
    const totalGrowCost = (requiredPots * unitPot) + (requiredFertilizer * unitFertilizer) + (requiredWater * unitWater) + (requiredLamps * unitLamp)
    const totalBrickCost = totalBricks * brickCost
    const totalPouchCost = totalPouches * pouchCost
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
      totalSeedCost,
      totalGrowCost,
      totalBrickCost,
      totalPouchCost,
      totalCost,
      totalRevenue,
      profit,
    }
  }, [brickTaxPercent, brickTransformCost, fertilizerPrice, lampPrice, leavesPerSeed, pouchSalePrice, pouchTransformCost, pouchesPerBrick, potPrice, seedPrice, seeds, waterPrice])

  return (
    <div className="space-y-4">
      <PageHeader title="Bénéfice drogue" subtitle="Simule ton coût total et ta marge par session" />
      <Panel>
        <div className="grid gap-3 md:grid-cols-3">
          <div><p className="mb-1 text-xs text-white/65">Nombre de graines</p><Input value={seeds} onChange={(e) => setSeeds(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Prix graine (unité)</p><Input value={seedPrice} onChange={(e) => setSeedPrice(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Prix pot (unité)</p><Input value={potPrice} onChange={(e) => setPotPrice(e.target.value)} inputMode="decimal" /></div>

          <div><p className="mb-1 text-xs text-white/65">Prix fertilisant (unité)</p><Input value={fertilizerPrice} onChange={(e) => setFertilizerPrice(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Prix eau (unité)</p><Input value={waterPrice} onChange={(e) => setWaterPrice(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Prix lampe (unité)</p><Input value={lampPrice} onChange={(e) => setLampPrice(e.target.value)} inputMode="decimal" /></div>

          <div><p className="mb-1 text-xs text-white/65">Feuilles par graine</p><Input value={leavesPerSeed} onChange={(e) => setLeavesPerSeed(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Taxe brick (%)</p><Input value={brickTaxPercent} onChange={(e) => setBrickTaxPercent(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Prix transfo brick (unité)</p><Input value={brickTransformCost} onChange={(e) => setBrickTransformCost(e.target.value)} inputMode="decimal" /></div>

          <div><p className="mb-1 text-xs text-white/65">Pochons par brick</p><Input value={pouchesPerBrick} onChange={(e) => setPouchesPerBrick(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Prix transfo pochon (unité)</p><Input value={pouchTransformCost} onChange={(e) => setPouchTransformCost(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Prix vente pochon (unité)</p><Input value={pouchSalePrice} onChange={(e) => setPouchSalePrice(e.target.value)} inputMode="decimal" /></div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Pots: <span className="font-semibold">{calc.requiredPots.toFixed(0)}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Fertilisant: <span className="font-semibold">{calc.requiredFertilizer.toFixed(0)}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Eau: <span className="font-semibold">{calc.requiredWater.toFixed(0)}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Lampes: <span className="font-semibold">{calc.requiredLamps.toFixed(0)}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Feuilles: <span className="font-semibold">{calc.totalLeaves.toFixed(2)}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Bricks nets: <span className="font-semibold">{calc.totalBricks.toFixed(2)}</span></div>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Bricks avant taxe: <span className="font-semibold">{calc.grossBricks.toFixed(2)}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Taxe brick: <span className="font-semibold">{calc.taxesOnBricks.toFixed(2)}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Pochons: <span className="font-semibold">{calc.totalPouches.toFixed(2)}</span></div>
        </div>

        <div className="mt-2 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm">
          <p className="text-xs text-cyan-100/85">Scénario 100 graines (ta règle)</p>
          <p className="font-semibold">100 feuilles ➜ 95 bricks (taxe 5%) ➜ 950 pochons</p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm"><p className="text-xs text-amber-100/85">Coût graines</p><p className="font-semibold">{money(calc.totalSeedCost)}</p></div>
          <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm"><p className="text-xs text-amber-100/85">Coût pousse</p><p className="font-semibold">{money(calc.totalGrowCost)}</p></div>
          <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm"><p className="text-xs text-amber-100/85">Coût transfo brick</p><p className="font-semibold">{money(calc.totalBrickCost)}</p></div>
          <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm"><p className="text-xs text-amber-100/85">Coût transfo pochon</p><p className="font-semibold">{money(calc.totalPouchCost)}</p></div>
          <div className="rounded-xl border border-rose-300/25 bg-rose-500/10 p-3 text-sm"><p className="text-xs text-rose-100/85">Coût total</p><p className="font-semibold">{money(calc.totalCost)}</p></div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm"><p className="text-xs text-cyan-100/85">Vente totale pochons</p><p className="text-lg font-semibold">{money(calc.totalRevenue)}</p></div>
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-sm"><p className="text-xs text-emerald-100/85">Bénéfice estimé</p><p className="text-lg font-semibold">{money(calc.profit)}</p></div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/coke/preparer"><SecondaryButton>Préparer session coke</SecondaryButton></Link>
          <Link href="/coke/cloturer"><SecondaryButton>Clôturer session coke</SecondaryButton></Link>
          <Link href="/drogues"><SecondaryButton>Retour drogues</SecondaryButton></Link>
        </div>
      </Panel>
    </div>
  )
}
