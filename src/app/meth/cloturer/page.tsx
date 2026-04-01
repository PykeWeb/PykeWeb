'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FlaskConical, Image as ImageIcon, Package, TestTube2, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { createFinanceTransaction, listCatalogItemsUnified } from '@/lib/itemsApi'
import { markStockOutNote } from '@/lib/financeStockFlow'
import type { CatalogItem } from '@/lib/types/itemsFinance'

function normalize(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function findItemByAliases(items: CatalogItem[], aliases: string[]) {
  const normalizedAliases = aliases.map((alias) => normalize(alias))
  const scored = items.map((item) => {
    const name = normalize(item.name)
    let score = -1
    for (const alias of normalizedAliases) {
      if (name === alias) score = Math.max(score, 100)
      else if (name.startsWith(`${alias} `) || name.endsWith(` ${alias}`)) score = Math.max(score, 80)
      else if (alias.length >= 4 && name.includes(alias)) score = Math.max(score, 60)
    }
    return { item, score }
  })
  return scored.filter((row) => row.score >= 0).sort((a, b) => b.score - a.score)[0]?.item || null
}

export default function MethClosePage() {
  const router = useRouter()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [tables, setTables] = useState('3')
  const [realMachines, setRealMachines] = useState('3')
  const [realBatteries, setRealBatteries] = useState('6')
  const [realAmmonia, setRealAmmonia] = useState('18')
  const [realMethylamine, setRealMethylamine] = useState('15')
  const [realMethBrut, setRealMethBrut] = useState('48')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void listCatalogItemsUnified().then(setItems).catch(() => setItems([]))
  }, [])

  useEffect(() => {
    const tableCount = Math.max(0, Number(tables) || 0)
    setRealMachines(String(tableCount))
    setRealBatteries(String(tableCount * 2))
    setRealAmmonia(String(tableCount * 6))
    setRealMethylamine(String(tableCount * 5))
    setRealMethBrut(String(Math.round(tableCount * 16)))
  }, [tables])

  const rows = useMemo(() => {
    const shape = [
      { key: 'machine', label: 'Machine de meth', qty: Math.max(0, Math.floor(Number(realMachines) || 0)), aliases: ['machine de meth', 'machine meth'], icon: Wrench },
      { key: 'battery', label: 'Batterie', qty: Math.max(0, Math.floor(Number(realBatteries) || 0)), aliases: ['batterie', 'battery'], icon: Package },
      { key: 'ammonia', label: 'Ammoniaque', qty: Math.max(0, Math.floor(Number(realAmmonia) || 0)), aliases: ['ammoniaque'], icon: FlaskConical },
      { key: 'methylamine', label: 'Methylamine', qty: Math.max(0, Math.floor(Number(realMethylamine) || 0)), aliases: ['methylamine', 'méthylamine'], icon: TestTube2 },
    ]
    return shape.map((row) => {
      const item = findItemByAliases(items, row.aliases)
      const unit = Math.max(0, Number(item?.buy_price || 0))
      return { ...row, item, unit, subtotal: row.qty * unit }
    })
  }, [items, realAmmonia, realBatteries, realMachines, realMethylamine])

  const totalCost = useMemo(() => rows.reduce((sum, row) => sum + row.subtotal, 0), [rows])

  async function submit() {
    setSaving(true)
    try {
      for (const row of rows) {
        if (row.qty <= 0 || !row.item) continue
        await createFinanceTransaction({
          item_id: row.item.id,
          mode: 'sell',
          quantity: row.qty,
          unit_price: 0,
          counterparty: 'Session meth',
          notes: markStockOutNote('Clôture session meth'),
          payment_mode: 'other',
        })
      }

      const output = findItemByAliases(items, ['pochon de meth', 'pochon meth', 'sachet meth'])
      const qty = Math.max(0, Math.floor((Number(realMethBrut) || 0) * 2))
      if (output && qty > 0) {
        await createFinanceTransaction({
          item_id: output.id,
          mode: 'buy',
          quantity: qty,
          unit_price: 0,
          counterparty: 'Session meth',
          notes: 'Clôture session meth',
          payment_mode: 'other',
        })
      }

      toast.success('Session meth validée.')
      router.push('/items?view=tools')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur session meth')
    } finally {
      setSaving(false)
    }
  }

  const approxPouches = Math.max(0, Math.floor((Number(realMethBrut) || 0) * 2))

  return (
    <Panel>
      <h1 className="mb-2 text-xl font-semibold">Session Meth</h1>
      <p className="mb-3 text-sm text-white/70">Session table par table: 1 machine, 2 batteries, 6 ammoniaque, 5 methylamine.</p>

      <div className="mb-3 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3">
        <p className="mb-1 text-xs text-cyan-100/85">Nombre de tables</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTables(String(Math.max(0, (Number(tables) || 0) - 1)))} className="h-9 w-9 rounded-lg border border-white/15 bg-white/[0.04] text-lg">-</button>
          <Input value={tables} onChange={(e) => setTables(e.target.value)} inputMode="numeric" />
          <button type="button" onClick={() => setTables(String((Number(tables) || 0) + 1))} className="h-9 w-9 rounded-lg border border-white/15 bg-white/[0.04] text-lg">+</button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row) => {
          const Icon = row.icon
          return (
            <div key={row.key} className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-2.5">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                  {row.item?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.item.image_url} alt={row.label} className="h-full w-full object-cover" loading="lazy" />
                  ) : <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-3.5 w-3.5" /></div>}
                </div>
                <p className="text-sm font-medium">{row.label}</p>
              </div>
              <p className="text-xs text-white/70">Besoin: <span className="font-semibold text-cyan-100">{row.qty}</span></p>
              <p className="text-xs text-white/70">PU: <span className="font-semibold">{Math.round(row.unit)} $</span></p>
              <p className="text-xs text-white/70">Sous-total: <span className="font-semibold text-emerald-100">{Math.round(row.subtotal)} $</span></p>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-white/55"><Icon className="h-3.5 w-3.5" />Table-based</div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs text-emerald-100/80">Meth pur récupérée (modifiable)</p>
            <span className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">~ {approxPouches} pochons</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRealMethBrut(String(Math.max(0, (Number(realMethBrut) || 0) - 1)))} className="h-9 w-9 rounded-lg border border-white/15 bg-white/[0.04] text-lg">-</button>
            <Input value={realMethBrut} onChange={(e) => setRealMethBrut(e.target.value)} inputMode="numeric" />
            <button type="button" onClick={() => setRealMethBrut(String((Number(realMethBrut) || 0) + 1))} className="h-9 w-9 rounded-lg border border-white/15 bg-white/[0.04] text-lg">+</button>
          </div>
          <p className="mt-2 text-xs text-emerald-100/75">Pochons approximatifs (x2): <span className="font-semibold">{approxPouches}</span></p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <PrimaryButton onClick={() => void submit()} disabled={saving}>Valider</PrimaryButton>
        <Link href="/drogues"><SecondaryButton>Retour</SecondaryButton></Link>
      </div>
    </Panel>
  )
}
