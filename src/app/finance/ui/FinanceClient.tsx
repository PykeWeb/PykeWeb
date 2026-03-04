'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Receipt, Wallet } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { PrimaryButton, SearchInput, SecondaryButton } from '@/components/ui/design-system'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { listFinanceEntries, type FinanceCategory, type FinanceEntry, type FinanceMovementType } from '@/lib/financeApi'
import { createFinanceTransaction } from '@/lib/itemsApi'
import { FinanceItemTradeModal } from '@/components/ui/FinanceItemTradeModal'
import { toast } from 'sonner'
import { copy } from '@/lib/copy'

type FilterType = 'all' | FinanceMovementType
type FilterCategory = 'all' | FinanceCategory

const typeLabels: Record<FinanceMovementType, string> = { expense: 'Dépense', purchase: 'Achat', sale: 'Vente/Sortie' }
const categoryLabels: Record<FinanceCategory, string> = { objects: 'Objets', weapons: 'Armes', equipment: 'Équipement', drugs: 'Drogues', custom: 'Custom', other: 'Autre' }

export default function FinanceClient() {
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState<FilterType>('all')
  const [category, setCategory] = useState<FilterCategory>('all')
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell' | null>(null)
  const [selectedCounterparty, setSelectedCounterparty] = useState<string | null>(null)

  async function refresh() {
    try {
      setLoading(true)
      setEntries(await listFinanceEntries())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : copy.finance.errors.loadFailed)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return entries.filter((entry) => {
      if (type !== 'all' && entry.movement_type !== type) return false
      if (category !== 'all' && entry.category !== category) return false
      if (!query) return true
      return `${entry.item_label} ${entry.member_name || ''} ${entry.notes || ''}`.toLowerCase().includes(query)
    })
  }, [entries, q, type, category])

  const pendingExpenses = useMemo(() => filtered.filter((e) => e.movement_type === 'expense' && e.expense_status !== 'paid').reduce((s, e) => s + (e.amount || 0), 0), [filtered])
  const paidExpenses = useMemo(() => filtered.filter((e) => e.movement_type === 'expense' && e.expense_status === 'paid').reduce((s, e) => s + (e.amount || 0), 0), [filtered])
  const purchases = useMemo(() => filtered.filter((e) => e.movement_type === 'purchase').reduce((s, e) => s + (e.amount || 0), 0), [filtered])
  const sales = useMemo(() => filtered.filter((e) => e.movement_type === 'sale').reduce((s, e) => s + (e.amount || 0), 0), [filtered])

  const counterpartyStats = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>()
    for (const entry of filtered) {
      const name = (entry.member_name || '').trim()
      if (!name) continue
      const current = map.get(name) || { total: 0, count: 0 }
      current.count += 1
      current.total += Number(entry.amount || 0)
      map.set(name, current)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [filtered])



  return (
    <Panel>
      <div className="mb-4 flex items-center justify-end gap-2">
        <Link href="/depenses/nouveau"><SecondaryButton>Nouvelle dépense</SecondaryButton></Link>
        <PrimaryButton onClick={() => setTradeMode('buy')}>Achat / Vente</PrimaryButton>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Dépenses en attente</p><p className="mt-1 text-xl font-semibold">{pendingExpenses.toFixed(2)} $</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Dépenses remboursées</p><p className="mt-1 text-xl font-semibold">{paidExpenses.toFixed(2)} $</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Achats</p><p className="mt-1 text-xl font-semibold">{purchases.toFixed(2)} $</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Ventes / Sorties</p><p className="mt-1 text-xl font-semibold">{sales.toFixed(2)} $</p></div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <SearchInput value={q} onChange={(e) => { setQ(e.target.value); setSelectedCounterparty(null) }} placeholder="Recherche (item / interlocuteur / note)" className="w-[360px]" />
        <GlassSelect value={type} onChange={(v) => setType(v as FilterType)} options={[{ value: 'all', label: 'Tous les types' }, { value: 'expense', label: 'Dépense' }, { value: 'purchase', label: 'Achat' }, { value: 'sale', label: 'Vente / Sortie' }]} />
        <GlassSelect value={category} onChange={(v) => setCategory(v as FilterCategory)} options={[{ value: 'all', label: 'Toutes catégories' }, { value: 'objects', label: 'Objets' }, { value: 'weapons', label: 'Armes' }, { value: 'equipment', label: 'Équipement' }, { value: 'drugs', label: 'Drogues' }, { value: 'custom', label: 'Custom' }]} />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-white/70"><tr><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Catégorie</th><th className="px-4 py-3 text-left">Item / Interlocuteur</th><th className="px-4 py-3 text-left">Qté</th><th className="px-4 py-3 text-left">Montant</th><th className="px-4 py-3 text-left">Date</th></tr></thead>
          <tbody className="divide-y divide-white/10">
            {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-white/60">Chargement…</td></tr> : null}
            {!loading && filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-white/60">Aucun mouvement.</td></tr> : null}
            {!loading ? filtered.map((entry) => (
              <tr key={`${entry.source}:${entry.id}`} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs">{entry.movement_type === 'expense' ? <Receipt className="h-3 w-3" /> : entry.movement_type === 'purchase' ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}{typeLabels[entry.movement_type]}</span></td>
                <td className="px-4 py-3">{categoryLabels[entry.category] || 'Autre'}</td>
                <td className="px-4 py-3"><div className="font-semibold">{entry.item_label}</div>{entry.member_name ? <div className="text-xs text-white/60">Interlocuteur: {entry.member_name}</div> : null}{entry.notes ? <div className="text-xs text-white/50 line-clamp-1">{entry.notes}</div> : null}</td>
                <td className="px-4 py-3">{entry.quantity}</td>
                <td className="px-4 py-3">{entry.amount == null ? '—' : `${Number(entry.amount).toFixed(2)} $`}</td>
                <td className="px-4 py-3 text-white/70">{new Date(entry.created_at).toLocaleString()}</td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Stats interlocuteurs</h3>
          {selectedCounterparty ? (
            <button
              type="button"
              onClick={() => { setQ(''); setSelectedCounterparty(null) }}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              Retour à tous
            </button>
          ) : null}
        </div>
        {counterpartyStats.length === 0 ? <p className="mt-2 text-xs text-white/60">Aucune transaction avec interlocuteur pour le filtre actuel.</p> : null}
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {counterpartyStats.map((row) => (
            <button
              key={row.name}
              type="button"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left hover:bg-white/[0.08]"
              onClick={() => {
                setQ(row.name)
                setSelectedCounterparty(row.name)
              }}
            >
              <div className="text-sm font-semibold">{row.name}</div>
              <div className="text-xs text-white/65">{row.count} transaction(s) · {row.total.toFixed(2)} $</div>
            </button>
          ))}
        </div>
      </div>
      {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">❌ {error}</div> : null}
      <p className="mt-4 text-xs text-white/55"><Wallet className="mr-1 inline h-3 w-3" />Le total global affiché dépend du filtre courant.</p>

      <FinanceItemTradeModal
        open={!!tradeMode}
        mode={tradeMode || 'buy'}
        enableModeSelect
        onClose={() => setTradeMode(null)}
        onSubmit={async (payload) => {
          await createFinanceTransaction({
            item_id: payload.item.id,
            mode: payload.mode,
            quantity: payload.quantity,
            unit_price: payload.unitPrice,
            counterparty: payload.counterparty,
            notes: payload.notes,
          })
          toast.success(copy.finance.toastSaved)
          await refresh()
        }}
      />
    </Panel>
  )
}
