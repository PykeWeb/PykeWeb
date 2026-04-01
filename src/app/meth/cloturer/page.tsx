'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { createFinanceTransaction, listCatalogItemsUnified } from '@/lib/itemsApi'
import { markStockOutNote } from '@/lib/financeStockFlow'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import { buildMethSessionPlan, METH_SESSION_STORAGE_KEY } from '@/lib/cokeSessionStorage'

function normalize(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function findItemByAliases(items: CatalogItem[], aliases: string[]) {
  const a = aliases.map(normalize)
  return items.find((item) => a.some((alias) => normalize(item.name).includes(alias))) || null
}

export default function MethClosePage() {
  const router = useRouter()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [zones, setZones] = useState('1')
  const [realMachines, setRealMachines] = useState('3')
  const [realTables, setRealTables] = useState('3')
  const [realBatteries, setRealBatteries] = useState('6')
  const [realAmmonia, setRealAmmonia] = useState('18')
  const [realMethylamine, setRealMethylamine] = useState('15')
  const [realPouches, setRealPouches] = useState('3')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void listCatalogItemsUnified().then(setItems).catch(() => setItems([]))
  }, [])

  useEffect(() => {
    const plan = buildMethSessionPlan(Number(zones))
    setRealMachines(String(plan.machines))
    setRealTables(String(plan.tables))
    setRealBatteries(String(plan.batteries))
    setRealAmmonia(String(plan.ammonia))
    setRealMethylamine(String(plan.methylamine))
    setRealPouches(String(plan.theoreticalPouches))
    window.localStorage.setItem(METH_SESSION_STORAGE_KEY, JSON.stringify(plan))
  }, [zones])

  const totalCost = useMemo(() => {
    const rows = [
      { qty: Number(realMachines) || 0, item: findItemByAliases(items, ['machine de meth', 'machine meth']) },
      { qty: Number(realTables) || 0, item: findItemByAliases(items, ['table']) },
      { qty: Number(realBatteries) || 0, item: findItemByAliases(items, ['batterie', 'battery']) },
      { qty: Number(realAmmonia) || 0, item: findItemByAliases(items, ['ammoniaque']) },
      { qty: Number(realMethylamine) || 0, item: findItemByAliases(items, ['methylamine', 'méthylamine']) },
    ]
    return rows.reduce((sum, row) => sum + (Math.max(0, row.qty) * Math.max(0, Number(row.item?.buy_price || 0))), 0)
  }, [items, realAmmonia, realBatteries, realMachines, realMethylamine, realTables])

  async function submit() {
    setSaving(true)
    try {
      const consumeRows = [
        { label: 'Machine de meth', qty: Number(realMachines) || 0 },
        { label: 'Table', qty: Number(realTables) || 0 },
        { label: 'Batterie', qty: Number(realBatteries) || 0 },
        { label: 'Ammoniaque', qty: Number(realAmmonia) || 0 },
        { label: 'Methylamine', qty: Number(realMethylamine) || 0 },
      ]
      for (const row of consumeRows) {
        if (row.qty <= 0) continue
        const item = findItemByAliases(items, [row.label])
        if (!item) continue
        await createFinanceTransaction({
          item_id: item.id,
          mode: 'sell',
          quantity: Math.max(0, Math.floor(row.qty)),
          unit_price: 0,
          counterparty: 'Session meth',
          notes: markStockOutNote('Clôture session meth'),
          payment_mode: 'other',
        })
      }

      const output = findItemByAliases(items, ['pochon de meth', 'pochon meth', 'sachet meth'])
      const qty = Math.max(0, Math.floor(Number(realPouches) || 0))
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

  return (
    <Panel>
      <h1 className="mb-3 text-xl font-semibold">Session Meth</h1>
      <p className="mb-3 text-sm text-white/70">Règle: 1 zone = 3 machines meth.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><p className="text-xs text-white/70">Zones prévues</p><Input value={zones} onChange={(e) => setZones(e.target.value)} inputMode="numeric" /></div>
        <div><p className="text-xs text-white/70">Machines utilisées</p><Input value={realMachines} onChange={(e) => setRealMachines(e.target.value)} inputMode="numeric" /></div>
        <div><p className="text-xs text-white/70">Tables utilisées</p><Input value={realTables} onChange={(e) => setRealTables(e.target.value)} inputMode="numeric" /></div>
        <div><p className="text-xs text-white/70">Batteries utilisées</p><Input value={realBatteries} onChange={(e) => setRealBatteries(e.target.value)} inputMode="numeric" /></div>
        <div><p className="text-xs text-white/70">Ammoniaque utilisée</p><Input value={realAmmonia} onChange={(e) => setRealAmmonia(e.target.value)} inputMode="numeric" /></div>
        <div><p className="text-xs text-white/70">Methylamine utilisée</p><Input value={realMethylamine} onChange={(e) => setRealMethylamine(e.target.value)} inputMode="numeric" /></div>
        <div className="sm:col-span-2"><p className="text-xs text-white/70">Pochons meth récupérés</p><Input value={realPouches} onChange={(e) => setRealPouches(e.target.value)} inputMode="numeric" /></div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
        <p>Coût équipement estimé: <span className="font-semibold">{Math.round(totalCost)} $</span></p>
      </div>

      <div className="mt-4 flex gap-2">
        <PrimaryButton onClick={() => void submit()} disabled={saving}>Valider</PrimaryButton>
        <Link href="/drogues"><SecondaryButton>Retour</SecondaryButton></Link>
        <Link href="/drogues/benefice"><SecondaryButton>Bénéfice</SecondaryButton></Link>
      </div>
    </Panel>
  )
}
