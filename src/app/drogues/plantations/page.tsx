'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Calculator, Factory, Plus } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { adjustDrugStock, listDrugItems, type DbDrugItem } from '@/lib/drugsApi'
import { buildDrugCalculatorResult, type DrugCalcMode } from '@/lib/drugCalculator'

type Recipe = {
  key: string
  title: string
  subtitle: string
  requirements: { name: string; qty: number }[]
  output: { name: string; qty: number; range?: [number, number] }
}

const RECIPES: Recipe[] = [
  {
    key: 'coke_leaf',
    title: 'Plantation coke (1 pot)',
    subtitle: '1 pot + 1 graine + 1 engrais + 3 eau = 1 feuille',
    requirements: [
      { name: 'Pot', qty: 1 },
      { name: 'Graine de coke', qty: 1 },
      { name: 'Engrais', qty: 1 },
      { name: 'Eau', qty: 3 },
    ],
    output: { name: 'Feuille de coke', qty: 1 },
  },
  {
    key: 'meth_brut',
    title: 'Cook meth (1 batch)',
    subtitle: 'Table + Meth + Batteries + chimie = 10 à 30 meth brut',
    requirements: [
      { name: 'Table', qty: 1 },
      { name: 'Meth', qty: 1 },
      { name: 'Batterie', qty: 2 },
      { name: 'Ammoniaque', qty: 16 },
      { name: 'Methylamine', qty: 15 },
    ],
    output: { name: 'Meth brut', qty: 0, range: [10, 30] },
  },
]

function findByKeyword(items: DbDrugItem[], keyword: string) {
  const k = keyword.toLowerCase()
  return items.filter((it) => (it.name || '').toLowerCase().includes(k))
}

export default function DroguesPlantationsPage() {
  const [items, setItems] = useState<DbDrugItem[]>([])
  const [calcMode, setCalcMode] = useState<DrugCalcMode>('coke')
  const [calcQuantity, setCalcQuantity] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setItems(await listDrugItems())
  }

  useEffect(() => {
    void refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erreur'))
  }, [])

  const possibleBatches = useMemo(() => {
    const res: Record<string, number> = {}
    for (const r of RECIPES) {
      const limits: number[] = []
      for (const req of r.requirements) {
        const matches = findByKeyword(items, req.name)
        const totalStock = matches.reduce((sum, it) => sum + (it.stock || 0), 0)
        limits.push(Math.floor(totalStock / req.qty))
      }
      res[r.key] = limits.length ? Math.max(0, Math.min(...limits)) : 0
    }
    return res
  }, [items])

  const producedCokeLeaves = useMemo(() => findByKeyword(items, 'Feuille de coke').reduce((sum, it) => sum + Number(it.stock || 0), 0), [items])
  const producedMethBrut = useMemo(() => findByKeyword(items, 'Meth brut').reduce((sum, it) => sum + Number(it.stock || 0), 0), [items])
  const calculatorResult = useMemo(() => buildDrugCalculatorResult(calcMode, Math.max(1, Math.floor(calcQuantity || 1)), items.map((it) => ({ name: it.name, price: it.price }))), [calcMode, calcQuantity, items])

  async function produce(recipe: Recipe) {
    try {
      setBusyId(recipe.key)
      setError(null)
      for (const req of recipe.requirements) {
        const matches = findByKeyword(items, req.name)
        if (!matches.length) throw new Error(`Item manquant: ${req.name}`)
        await adjustDrugStock({ itemId: matches[0].id, delta: -req.qty, note: `Production: ${recipe.title}` })
      }
      const outMatches = findByKeyword(items, recipe.output.name)
      if (!outMatches.length) throw new Error(`Crée l'item output \"${recipe.output.name}\" dans le catalogue.`)
      const delta = recipe.output.range
        ? Math.floor(Math.random() * (recipe.output.range[1] - recipe.output.range[0] + 1)) + recipe.output.range[0]
        : recipe.output.qty
      await adjustDrugStock({ itemId: outMatches[0].id, delta, note: `Production: ${recipe.title}` })
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Plantations & Calculateur</h2>
        <div className="flex gap-2">
          <Link href="/drogues"><SecondaryButton>Retour drogues</SecondaryButton></Link>
          <Link href="/drogues/nouveau"><PrimaryButton>Ajouter un item</PrimaryButton></Link>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-white/80" />
          <p className="text-sm font-semibold">Calculateur</p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs text-white/60">Type</label>
            <GlassSelect value={calcMode} onChange={(v) => setCalcMode(v as DrugCalcMode)} options={[{ value: 'coke', label: 'Coke' }, { value: 'meth', label: 'Meth' }]} />
          </div>
          <div>
            <label className="text-xs text-white/60">Quantité</label>
            <input type="number" min={1} step={1} value={calcQuantity} onChange={(e) => setCalcQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          </div>
          <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-sm">
            Total connu: <span className="font-semibold">{calculatorResult.totalKnown.toFixed(0)}$</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2"><Factory className="h-4 w-4 text-white/80" /><p className="text-sm font-semibold">Production en stock</p></div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span>Feuille de coke</span><span className="font-semibold">{producedCokeLeaves}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"><span>Meth brut</span><span className="font-semibold">{producedMethBrut}</span></div>
          </div>
        </div>

        {RECIPES.map((r) => {
          const canDo = (possibleBatches[r.key] ?? 0) > 0
          return (
            <div key={r.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold">{r.title}</p>
              <p className="mt-1 text-xs text-white/60">{r.subtitle}</p>
              <div className="mt-3 space-y-2 text-xs text-white/70">
                {r.requirements.map((req) => (
                  <div key={req.name} className="grid grid-cols-2 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"><span>{req.name}</span><span className="text-right">× {req.qty}</span></div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">Output : {r.output.name}{' '}{r.output.range ? `(${r.output.range[0]} à ${r.output.range[1]})` : `× ${r.output.qty}`}</div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-white/60">Batches possibles : {possibleBatches[r.key] ?? 0}</span>
                <button disabled={!canDo || busyId === r.key} onClick={() => void produce(r)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50">
                  <Plus className="h-4 w-4" /> Produire
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">❌ {error}</div> : null}
    </Panel>
  )
}
