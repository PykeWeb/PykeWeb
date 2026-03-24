'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CokeSessionHeader } from '@/components/coke/CokeSessionHeader'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem } from '@/lib/types/itemsFinance'
import { buildCokeSessionPlan, COKE_SESSION_STORAGE_KEY } from '@/lib/cokeSessionStorage'

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

export default function CokePreparePage() {
  const router = useRouter()
  const [seeds, setSeeds] = useState('1')
  const [zones, setZones] = useState('1')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void listCatalogItemsUnified().then((rows) => setItems(rows)).finally(() => setLoading(false))
  }, [])

  const plan = useMemo(() => buildCokeSessionPlan(Number(seeds), Number(zones)), [seeds, zones])

  const resources = useMemo(() => ([
    { key: 'seed', label: 'Graine de coke', qty: plan.seeds },
    { key: 'pot', label: 'Pot', qty: plan.pots },
    { key: 'fert', label: 'Fertilisant', qty: plan.fertilizer },
    { key: 'water', label: "Bouteille d'eau", qty: plan.water },
    { key: 'lamp', label: 'Lampe', qty: plan.lamps },
  ].map((entry) => {
    const item = entry.key === 'water'
      ? findItemByAliases(items, ["Bouteille d'eau", 'Bouteille eau', 'Water bottle', 'Water'])
      : findItem(items, entry.label)
    const stock = Math.max(0, Number(item?.stock || 0))
    const missing = Math.max(0, entry.qty - stock)
    const pu = item?.buy_price ?? null
    return { ...entry, item, stock, missing, missingCost: pu == null ? null : missing * pu, pu }
  })), [items, plan.fertilizer, plan.lamps, plan.pots, plan.seeds, plan.water])

  const totals = useMemo(() => {
    const totalMissingCost = resources.reduce((sum, entry) => sum + (entry.missingCost ?? 0), 0)
    const totalPlannedCostKnown = resources.reduce((sum, entry) => sum + ((entry.pu == null ? 0 : entry.qty * entry.pu)), 0)
    const missingPriceLabels = resources.filter((entry) => entry.pu == null).map((entry) => entry.label)
    return { totalMissingCost, totalPlannedCostKnown, missingPriceLabels }
  }, [resources])

  return (
    <div className="space-y-4">
      <PageHeader title="Préparer une session coke" subtitle="Prépare ta session avant de partir en plantation" />
      <Panel>
        <div className="space-y-4">
          <CokeSessionHeader title="Préparer une session coke" subtitle="Prévision complète avant départ (sans impact stock)." tone="cyan" />

          <div className="grid gap-2 sm:grid-cols-2">
            <div><p className="mb-1 text-xs text-white/65">Graines prévues</p><Input value={seeds} onChange={(e) => setSeeds(e.target.value)} inputMode="numeric" className="h-10 rounded-lg" /></div>
            <div><p className="mb-1 text-xs text-white/65">Zones prévues</p><Input value={zones} onChange={(e) => setZones(e.target.value)} inputMode="numeric" className="h-10 rounded-lg" /></div>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">Pots: <span className="font-semibold">{plan.pots}</span></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">Fertilisant: <span className="font-semibold">{plan.fertilizer}</span></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">Eau: <span className="font-semibold">{plan.water}</span></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">Lampes: <span className="font-semibold">{plan.lamps}</span></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">Feuilles théoriques: <span className="font-semibold">{plan.theoreticalLeaves}</span></div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm">
              <p className="text-xs text-cyan-100/85">Coût total session (quantités prévues)</p>
              <p className="mt-1 text-lg font-semibold">{formatPrice(totals.totalPlannedCostKnown)}</p>
            </div>
            <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm">
              <p className="text-xs text-amber-100/85">Coût total du manque à acheter</p>
              <p className="mt-1 text-lg font-semibold">{formatPrice(totals.totalMissingCost)}</p>
              {totals.missingPriceLabels.length > 0 ? <p className="mt-1 text-[11px] text-amber-100/75">Prix manquant: {totals.missingPriceLabels.join(', ')}</p> : null}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {resources.map((entry) => (
              <div key={entry.key} className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] p-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                    {entry.item?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.item.image_url} alt={entry.label} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-4 w-4" /></div>
                    )}
                  </div>
                  <p className="font-medium">{entry.label}</p>
                </div>
                <div className="mt-2 grid gap-1 text-xs">
                  <div className="flex justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1"><span>Besoin</span><span className="font-semibold">{entry.qty}</span></div>
                  <div className="flex justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1"><span>Stock</span><span className="font-semibold">{entry.stock}</span></div>
                  <div className="flex justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1"><span>Manque</span><span className={`font-semibold ${entry.missing > 0 ? 'text-rose-200' : 'text-emerald-200'}`}>{entry.missing}</span></div>
                  <div className="flex justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1"><span>PU</span><span className="font-semibold">{formatPrice(entry.pu)}</span></div>
                  <div className="flex justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1"><span>Coût manque</span><span className="font-semibold">{formatPrice(entry.missingCost)}</span></div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              disabled={loading}
              onClick={() => {
                window.localStorage.setItem(COKE_SESSION_STORAGE_KEY, JSON.stringify(plan))
                router.push('/coke/cloturer')
              }}
            >
              Démarrer la session
            </PrimaryButton>
            <Link href="/items?view=tools"><SecondaryButton>Retour calculateur</SecondaryButton></Link>
            <Link href="/drogues/benefice"><SecondaryButton>Bénéfice drogue</SecondaryButton></Link>
          </div>
        </div>
      </Panel>
    </div>
  )
}
