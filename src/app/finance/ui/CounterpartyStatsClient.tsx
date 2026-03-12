'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownRight, ArrowUpRight, Receipt, UserRound, Wallet } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { PrimaryButton, SearchInput, SecondaryButton } from '@/components/ui/design-system'
import { listFinanceEntries, type FinanceEntry, type FinanceMovementType } from '@/lib/financeApi'
import { getFinanceListImage } from '@/lib/financeVisuals'

type FilterType = 'all' | FinanceMovementType

type CounterpartyAggregate = {
  name: string
  totalAmount: number
  totalCount: number
  purchases: number
  stockIns: number
  sales: number
  stockOuts: number
  expenses: number
  lastAt: string | null
}

const typeIcon: Record<FinanceMovementType, JSX.Element> = {
  expense: <Receipt className="h-3.5 w-3.5" />,
  purchase: <ArrowDownRight className="h-3.5 w-3.5" />,
  stock_in: <ArrowDownRight className="h-3.5 w-3.5" />,
  sale: <ArrowUpRight className="h-3.5 w-3.5" />,
  stock_out: <ArrowUpRight className="h-3.5 w-3.5" />,
}

const typeLabel: Record<FinanceMovementType, string> = {
  expense: 'Dépense',
  purchase: 'Achat',
  stock_in: 'Entrée',
  sale: 'Vente',
  stock_out: 'Sortie',
}

function buildCounterpartyStats(entries: FinanceEntry[]): CounterpartyAggregate[] {
  const map = new Map<string, CounterpartyAggregate>()

  for (const entry of entries) {
    const name = (entry.member_name ?? '').trim()
    if (!name) continue
    const current = map.get(name) ?? {
      name,
      totalAmount: 0,
      totalCount: 0,
      purchases: 0,
      stockIns: 0,
      sales: 0,
      stockOuts: 0,
      expenses: 0,
      lastAt: null,
    }

    const amount = Number(entry.amount ?? 0)
    current.totalAmount += Number.isFinite(amount) ? amount : 0
    current.totalCount += 1

    if (entry.movement_type === 'purchase') current.purchases += 1
    if (entry.movement_type === 'stock_in') current.stockIns += 1
    if (entry.movement_type === 'sale') current.sales += 1
    if (entry.movement_type === 'stock_out') current.stockOuts += 1
    if (entry.movement_type === 'expense') current.expenses += 1

    if (!current.lastAt || new Date(entry.created_at).getTime() > new Date(current.lastAt).getTime()) {
      current.lastAt = entry.created_at
    }

    map.set(name, current)
  }

  return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount)
}

export default function CounterpartyStatsClient() {
  const router = useRouter()
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState<FilterType>('all')
  const [selectedName, setSelectedName] = useState<string>('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const nextEntries = await listFinanceEntries()
        if (mounted) setEntries(nextEntries)
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : 'Impossible de charger les statistiques.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  const filteredEntries = useMemo(() => {
    const queryText = q.trim().toLowerCase()
    return entries.filter((entry) => {
      if (type !== 'all' && entry.movement_type !== type) return false
      if (!queryText) return true
      return `${entry.member_name ?? ''} ${entry.item_label} ${entry.notes ?? ''}`.toLowerCase().includes(queryText)
    })
  }, [entries, q, type])

  const aggregates = useMemo(() => buildCounterpartyStats(filteredEntries), [filteredEntries])

  const selectedEntries = useMemo(() => {
    if (!selectedName) return []
    return filteredEntries
      .filter((entry) => (entry.member_name ?? '').trim() === selectedName)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)
  }, [filteredEntries, selectedName])

  const globalTotal = useMemo(
    () => aggregates.reduce((sum, row) => sum + row.totalAmount, 0),
    [aggregates],
  )

  const allCount = entries.length
  const expenseCount = entries.filter((entry) => entry.movement_type === 'expense').length
  const purchaseCount = entries.filter((entry) => entry.movement_type === 'purchase').length
  const stockInCount = entries.filter((entry) => entry.movement_type === 'stock_in').length
  const saleCount = entries.filter((entry) => entry.movement_type === 'sale').length
  const stockOutCount = entries.filter((entry) => entry.movement_type === 'stock_out').length

  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <button type="button" onClick={() => setType('all')} className={`rounded-2xl border bg-gradient-to-br p-4 text-left transition ${type === 'all' ? 'border-slate-200/70 from-slate-400/35 to-slate-500/25' : 'border-white/15 from-white/10 to-white/5 hover:from-white/15 hover:to-white/8'}`}>
            <div className="flex items-center justify-between gap-2 text-slate-100/85"><p className="text-xs">Tous</p><UserRound className="h-4 w-4" /></div>
            <p className="mt-1 text-xl font-semibold">{allCount}</p>
          </button>
          <button type="button" onClick={() => setType('expense')} className={`rounded-2xl border bg-gradient-to-br p-4 text-left transition ${type === 'expense' ? 'border-amber-200/80 from-amber-500/35 to-orange-500/25' : 'border-amber-300/30 from-amber-500/20 to-orange-500/12 hover:from-amber-500/28 hover:to-orange-500/18'}`}>
            <div className="flex items-center justify-between gap-2 text-amber-100/85"><p className="text-xs">Dépenses</p><Receipt className="h-4 w-4" /></div>
            <p className="mt-1 text-xl font-semibold">{expenseCount}</p>
          </button>
          <button type="button" onClick={() => setType('purchase')} className={`rounded-2xl border bg-gradient-to-br p-4 text-left transition ${type === 'purchase' ? 'border-cyan-200/80 from-cyan-500/35 to-blue-500/25' : 'border-cyan-300/30 from-cyan-500/20 to-blue-500/12 hover:from-cyan-500/28 hover:to-blue-500/18'}`}>
            <div className="flex items-center justify-between gap-2 text-cyan-100/85"><p className="text-xs">Achats</p><ArrowDownRight className="h-4 w-4" /></div>
            <p className="mt-1 text-xl font-semibold">{purchaseCount}</p>
          </button>
          <button type="button" onClick={() => setType('stock_in')} className={`rounded-2xl border bg-gradient-to-br p-4 text-left transition ${type === 'stock_in' ? 'border-sky-200/80 from-sky-500/35 to-indigo-500/25' : 'border-sky-300/30 from-sky-500/20 to-indigo-500/12 hover:from-sky-500/28 hover:to-indigo-500/18'}`}>
            <div className="flex items-center justify-between gap-2 text-sky-100/85"><p className="text-xs">Entrées</p><ArrowDownRight className="h-4 w-4" /></div>
            <p className="mt-1 text-xl font-semibold">{stockInCount}</p>
          </button>
          <button type="button" onClick={() => setType('sale')} className={`rounded-2xl border bg-gradient-to-br p-4 text-left transition ${type === 'sale' ? 'border-violet-200/80 from-violet-500/35 to-fuchsia-500/25' : 'border-violet-300/30 from-violet-500/20 to-fuchsia-500/12 hover:from-violet-500/28 hover:to-fuchsia-500/18'}`}>
            <div className="flex items-center justify-between gap-2 text-violet-100/85"><p className="text-xs">Ventes</p><ArrowUpRight className="h-4 w-4" /></div>
            <p className="mt-1 text-xl font-semibold">{saleCount}</p>
          </button>
          <button type="button" onClick={() => setType('stock_out')} className={`rounded-2xl border bg-gradient-to-br p-4 text-left transition ${type === 'stock_out' ? 'border-rose-200/80 from-rose-500/35 to-orange-500/25' : 'border-rose-300/30 from-rose-500/20 to-orange-500/12 hover:from-rose-500/28 hover:to-orange-500/18'}`}>
            <div className="flex items-center justify-between gap-2 text-rose-100/85"><p className="text-xs">Sorties</p><ArrowUpRight className="h-4 w-4" /></div>
            <p className="mt-1 text-xl font-semibold">{stockOutCount}</p>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SearchInput
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Recherche interlocuteur / item / note"
            className="ml-1 w-full min-w-[240px] flex-1 max-w-[360px]"
          />
          <Link href="/finance">
            <SecondaryButton>Retour Finance</SecondaryButton>
          </Link>
          <Link href="/finance/achat-vente">
            <PrimaryButton>Achat / Vente</PrimaryButton>
          </Link>
        </div>
      </Panel>

      <div className="grid gap-3 md:grid-cols-3">
        <Panel>
          <p className="text-xs text-white/60">Interlocuteurs actifs</p>
          <p className="mt-1 text-2xl font-semibold">{aggregates.length}</p>
        </Panel>
        <Panel>
          <p className="text-xs text-white/60">Montant total filtré</p>
          <p className="mt-1 text-2xl font-semibold">{globalTotal.toFixed(2)} $</p>
        </Panel>
        <Panel>
          <p className="text-xs text-white/60">Mouvements analysés</p>
          <p className="mt-1 text-2xl font-semibold">{filteredEntries.length}</p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Panel>
          <h2 className="text-base font-semibold">Classement interlocuteurs</h2>
          {loading ? <p className="mt-3 text-sm text-white/60">Chargement…</p> : null}
          {!loading && aggregates.length === 0 ? <p className="mt-3 text-sm text-white/60">Aucune donnée pour les filtres actuels.</p> : null}
          <div className="mt-3 space-y-2">
            {aggregates.map((row) => (
              <button
                key={row.name}
                type="button"
                onClick={() => setSelectedName(row.name)}
                className={`w-full rounded-xl border px-3 py-2 text-left transition ${selectedName === row.name ? 'border-white/30 bg-white/[0.10]' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{row.name}</p>
                    <p className="text-xs text-white/60">
                      {row.totalCount} mouvement(s) · Achats {row.purchases} · Entrées {row.stockIns} · Ventes {row.sales} · Sorties {row.stockOuts} · Dépenses {row.expenses}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{row.totalAmount.toFixed(2)} $</p>
                    <p className="text-xs text-white/60">{row.lastAt ? new Date(row.lastAt).toLocaleString() : '—'}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-base font-semibold">Détail interlocuteur</h2>
          {!selectedName ? <p className="mt-3 text-sm text-white/60">Sélectionne un interlocuteur pour voir ses dernières opérations.</p> : null}
          {selectedName ? (
            <>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm">
                <UserRound className="h-4 w-4" />
                {selectedName}
              </div>
              <div className="mt-3 space-y-2">
                {selectedEntries.length === 0 ? <p className="text-sm text-white/60">Aucune opération trouvée.</p> : null}
                {selectedEntries.map((entry) => {
                  const imageUrl = getFinanceListImage({
                    movementType: entry.movement_type,
                    category: entry.category,
                    isMulti: entry.is_multi,
                    itemImageUrl: entry.item_image_url,
                  })
                  return (
                    <button
                      key={`${entry.source}:${entry.id}`}
                      type="button"
                      onClick={() => router.push(`/finance/transactions/${entry.source}/${encodeURIComponent(entry.id)}`)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition hover:bg-white/[0.08]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                            {imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={imageUrl} alt={entry.item_label} className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-[10px] text-white/40">IMG</div>
                            )}
                          </div>
                          <p className="text-sm font-semibold">{entry.item_label}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs">
                          {typeIcon[entry.movement_type]}
                          {typeLabel[entry.movement_type]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/65">Qté: {entry.quantity} · Montant: {Number(entry.amount ?? 0).toFixed(2)} $</p>
                      <p className="text-xs text-white/50">{new Date(entry.created_at).toLocaleString()}</p>
                    </button>
                  )
                })}
              </div>
            </>
          ) : null}
        </Panel>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          <Wallet className="mr-1 inline h-4 w-4" />
          {error}
        </div>
      ) : null}
    </div>
  )
}
