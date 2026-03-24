'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { CokeSessionHeader } from '@/components/coke/CokeSessionHeader'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { createFinanceTransaction, listCatalogItemsUnified } from '@/lib/itemsApi'
import { markStockOutNote } from '@/lib/financeStockFlow'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import { COKE_SESSION_STORAGE_KEY, type CokeSessionPlan } from '@/lib/cokeSessionStorage'

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
  return `${value.toFixed(2)} $`
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

  useEffect(() => {
    void listCatalogItemsUnified().then(setItems).catch(() => setItems([]))
    const raw = window.localStorage.getItem(COKE_SESSION_STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as CokeSessionPlan
      setPlan(parsed)
      setRealSeeds(String(parsed.seeds))
      setRealPots(String(parsed.pots))
      setRealFertilizer(String(parsed.fertilizer))
      setRealWater(String(parsed.water))
      setRealLamps(String(parsed.lamps))
      setRealLeaves(String(parsed.theoreticalLeaves))
    } catch {
      setPlan(null)
    }
  }, [])

  const rows = useMemo(() => {
    if (!plan) return []
    const real = {
      seeds: Math.max(0, Math.floor(Number(realSeeds) || 0)),
      pots: Math.max(0, Math.floor(Number(realPots) || 0)),
      fertilizer: Math.max(0, Math.floor(Number(realFertilizer) || 0)),
      water: Math.max(0, Math.floor(Number(realWater) || 0)),
      lamps: Math.max(0, Math.floor(Number(realLamps) || 0)),
      leaves: Math.max(0, Math.floor(Number(realLeaves) || 0)),
    }
    return [
      { key: 'seeds', label: 'Graines', planned: plan.seeds, real: real.seeds },
      { key: 'pots', label: 'Pots', planned: plan.pots, real: real.pots },
      { key: 'fert', label: 'Fertilisant', planned: plan.fertilizer, real: real.fertilizer },
      { key: 'water', label: 'Eau', planned: plan.water, real: real.water },
      { key: 'lamps', label: 'Lampes', planned: plan.lamps, real: real.lamps },
      { key: 'leaves', label: 'Feuilles', planned: plan.theoreticalLeaves, real: real.leaves },
    ]
  }, [plan, realFertilizer, realLamps, realLeaves, realPots, realSeeds, realWater])

  async function submit() {
    if (!plan) return
    setSaving(true)
    try {
      const consumables = [
        { label: 'Graine de coke', quantity: Math.max(0, Math.floor(Number(realSeeds) || 0)) },
        { label: 'Pot', quantity: Math.max(0, Math.floor(Number(realPots) || 0)) },
        { label: 'Fertilisant', quantity: Math.max(0, Math.floor(Number(realFertilizer) || 0)) },
        { label: "Bouteille d'eau", quantity: Math.max(0, Math.floor(Number(realWater) || 0)) },
        { label: 'Lampe', quantity: Math.max(0, Math.floor(Number(realLamps) || 0)) },
      ]

      for (const row of consumables) {
        if (row.quantity <= 0) continue
        const item = getConsumableItem(row.label)
        if (!item) continue
        await createFinanceTransaction({
          item_id: item.id,
          mode: 'sell',
          quantity: row.quantity,
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
      router.push('/items?view=tools')
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

  const sessionTotals = useMemo(() => {
    const consumables = [
      { label: 'Graine de coke', quantity: Math.max(0, Math.floor(Number(realSeeds) || 0)) },
      { label: 'Pot', quantity: Math.max(0, Math.floor(Number(realPots) || 0)) },
      { label: 'Fertilisant', quantity: Math.max(0, Math.floor(Number(realFertilizer) || 0)) },
      { label: "Bouteille d'eau", quantity: Math.max(0, Math.floor(Number(realWater) || 0)) },
      { label: 'Lampe', quantity: Math.max(0, Math.floor(Number(realLamps) || 0)) },
    ]
    const leavesQty = Math.max(0, Math.floor(Number(realLeaves) || 0))

    const totalConsumablesCost = consumables.reduce((sum, row) => {
      const item = getConsumableItem(row.label)
      const pu = Number(item?.buy_price ?? 0)
      return sum + row.quantity * (Number.isFinite(pu) ? pu : 0)
    }, 0)

    const outputItem = findItem(items, 'Feuille de Cocaïne')
    const sellPrice = Number(outputItem?.sell_price ?? outputItem?.buy_price ?? 0)
    const outputValue = leavesQty * (Number.isFinite(sellPrice) ? sellPrice : 0)
    const gross = outputValue - totalConsumablesCost
    return { totalConsumablesCost, outputValue, gross }
  }, [getConsumableItem, items, realFertilizer, realLamps, realLeaves, realPots, realSeeds, realWater])

  return (
    <div className="space-y-4">
      <PageHeader title="Clôturer une session coke" subtitle="Entre les résultats réels de ta session" />
      <Panel>
        {!plan ? (
          <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm">Aucune session préparée trouvée. <Link className="underline" href="/coke/preparer">Préparer une session</Link>.</div>
        ) : (
          <div className="space-y-4">
            <CokeSessionHeader title="Clôturer une session coke" subtitle="Saisie réelle et mise à jour stock." tone="amber" />

            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">Graines prévues: <span className="font-semibold">{plan.seeds}</span></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">Zones prévues: <span className="font-semibold">{plan.zones}</span></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">Lampes prévues: <span className="font-semibold">{plan.lamps}</span></div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {closeFields.map((field) => {
                const item = getItemForField(field.itemLabel)
                return (
                  <div key={field.label} className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                        {item?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image_url} alt={field.itemLabel} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-3.5 w-3.5" /></div>
                        )}
                      </div>
                      <p className="text-xs text-white/75">{field.label}</p>
                    </div>
                    <Input value={field.value} onChange={(e) => field.set(e.target.value)} inputMode="numeric" className="h-9 rounded-lg" />
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
                <p className="text-xs text-amber-100/85">Coût total réel consommables</p>
                <p className="mt-1 text-lg font-semibold">{formatPrice(sessionTotals.totalConsumablesCost)}</p>
              </div>
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm">
                <p className="text-xs text-cyan-100/85">Valeur des feuilles récupérées</p>
                <p className="mt-1 text-lg font-semibold">{formatPrice(sessionTotals.outputValue)}</p>
              </div>
              <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-sm">
                <p className="text-xs text-emerald-100/85">Marge brute session</p>
                <p className="mt-1 text-lg font-semibold">{formatPrice(sessionTotals.gross)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <PrimaryButton disabled={saving} onClick={() => { void submit() }}>{saving ? 'Validation...' : 'Valider la session'}</PrimaryButton>
              <Link href="/coke/preparer"><SecondaryButton>Retour préparer</SecondaryButton></Link>
              <Link href="/drogues"><SecondaryButton>Retour au calculateur</SecondaryButton></Link>
              <Link href="/drogues/benefice"><SecondaryButton>Bénéfice drogue</SecondaryButton></Link>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
