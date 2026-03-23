'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { SecondaryButton } from '@/components/ui/design-system'

function money(value: number) {
  return `${value.toFixed(2)} $`
}

export default function DroguesBeneficePage() {
  const [seeds, setSeeds] = useState('100')
  const [seedPrice, setSeedPrice] = useState('0')
  const [growCostPerSeed, setGrowCostPerSeed] = useState('0')
  const [leavesPerSeed, setLeavesPerSeed] = useState('1')
  const [leavesPerBrick, setLeavesPerBrick] = useState('20')
  const [brickTransformCost, setBrickTransformCost] = useState('0')
  const [pouchesPerBrick, setPouchesPerBrick] = useState('10')
  const [pouchTransformCost, setPouchTransformCost] = useState('0')
  const [pouchSalePrice, setPouchSalePrice] = useState('0')

  const calc = useMemo(() => {
    const seedQty = Math.max(0, Number(seeds) || 0)
    const unitSeedPrice = Math.max(0, Number(seedPrice) || 0)
    const unitGrowCost = Math.max(0, Number(growCostPerSeed) || 0)
    const leavesSeed = Math.max(0.0001, Number(leavesPerSeed) || 1)
    const leavesBrick = Math.max(0.0001, Number(leavesPerBrick) || 1)
    const brickCost = Math.max(0, Number(brickTransformCost) || 0)
    const pouchPerBrick = Math.max(0, Number(pouchesPerBrick) || 0)
    const pouchCost = Math.max(0, Number(pouchTransformCost) || 0)
    const unitSale = Math.max(0, Number(pouchSalePrice) || 0)

    const totalLeaves = seedQty * leavesSeed
    const totalBricks = totalLeaves / leavesBrick
    const totalPouches = totalBricks * pouchPerBrick

    const totalSeedCost = seedQty * unitSeedPrice
    const totalGrowCost = seedQty * unitGrowCost
    const totalBrickCost = totalBricks * brickCost
    const totalPouchCost = totalPouches * pouchCost
    const totalCost = totalSeedCost + totalGrowCost + totalBrickCost + totalPouchCost
    const totalRevenue = totalPouches * unitSale
    const profit = totalRevenue - totalCost

    return {
      totalLeaves,
      totalBricks,
      totalPouches,
      totalSeedCost,
      totalGrowCost,
      totalBrickCost,
      totalPouchCost,
      totalCost,
      totalRevenue,
      profit,
    }
  }, [brickTransformCost, growCostPerSeed, leavesPerBrick, leavesPerSeed, pouchSalePrice, pouchTransformCost, pouchesPerBrick, seedPrice, seeds])

  return (
    <div className="space-y-4">
      <PageHeader title="Bénéfice drogue" subtitle="Simule ton coût total et ta marge par session" />
      <Panel>
        <div className="grid gap-3 md:grid-cols-3">
          <div><p className="mb-1 text-xs text-white/65">Nombre de graines</p><Input value={seeds} onChange={(e) => setSeeds(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Prix graine (unité)</p><Input value={seedPrice} onChange={(e) => setSeedPrice(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Coût équipement pousse / graine</p><Input value={growCostPerSeed} onChange={(e) => setGrowCostPerSeed(e.target.value)} inputMode="decimal" /></div>

          <div><p className="mb-1 text-xs text-white/65">Feuilles par graine</p><Input value={leavesPerSeed} onChange={(e) => setLeavesPerSeed(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Feuilles par brick</p><Input value={leavesPerBrick} onChange={(e) => setLeavesPerBrick(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Prix transfo brick (unité)</p><Input value={brickTransformCost} onChange={(e) => setBrickTransformCost(e.target.value)} inputMode="decimal" /></div>

          <div><p className="mb-1 text-xs text-white/65">Pochons par brick</p><Input value={pouchesPerBrick} onChange={(e) => setPouchesPerBrick(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Prix transfo pochon (unité)</p><Input value={pouchTransformCost} onChange={(e) => setPouchTransformCost(e.target.value)} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/65">Prix vente pochon (unité)</p><Input value={pouchSalePrice} onChange={(e) => setPouchSalePrice(e.target.value)} inputMode="decimal" /></div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Feuilles: <span className="font-semibold">{calc.totalLeaves.toFixed(2)}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Bricks: <span className="font-semibold">{calc.totalBricks.toFixed(2)}</span></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Pochons: <span className="font-semibold">{calc.totalPouches.toFixed(2)}</span></div>
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

