'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Receipt, Wallet } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { SearchInput } from '@/components/ui/design-system'
import { listFinanceEntries, type FinanceCategory, type FinanceEntry, type FinanceMovementType } from '@/lib/financeApi'

type FilterType = 'all' | FinanceMovementType
type FilterCategory = 'all' | FinanceCategory

const typeLabels: Record<FinanceMovementType, string> = {
  expense: 'Dépense',
  purchase: 'Achat',
  sale: 'Vente/Sortie',
}

const categoryLabels: Record<FinanceCategory, string> = {
  objects: 'Objets',
  weapons: 'Armes',
  equipment: 'Équipement',
  drugs: 'Drogues',
  other: 'Autre',
}

export default function FinanceClient() {
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState<FilterType>('all')
  const [category, setCategory] = useState<FilterCategory>('all')

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        setEntries(await listFinanceEntries())
      } catch (e: any) {
        setError(e?.message || 'Impossible de charger la finance.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return entries.filter((entry) => {
      if (type !== 'all' && entry.movement_type !== type) return false
      if (category !== 'all' && entry.category !== category) return false
      if (!query) return true
      return `${entry.item_label} ${entry.member_name || ''}`.toLowerCase().includes(query)
    })
  }, [entries, q, type, category])

  const pendingExpenses = useMemo(() => filtered.filter((e) => e.movement_type === 'expense' && e.expense_status !== 'paid').reduce((s, e) => s + (e.amount || 0), 0), [filtered])
  const paidExpenses = useMemo(() => filtered.filter((e) => e.movement_type === 'expense' && e.expense_status === 'paid').reduce((s, e) => s + (e.amount || 0), 0), [filtered])
  const purchases = useMemo(() => filtered.filter((e) => e.movement_type === 'purchase').reduce((s, e) => s + (e.amount || 0), 0), [filtered])
  const sales = useMemo(() => filtered.filter((e) => e.movement_type === 'sale').reduce((s, e) => s + (e.amount || 0), 0), [filtered])

  return (
    <Panel>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Dépenses en attente</p><p className="mt-1 text-xl font-semibold">{pendingExpenses.toFixed(2)} $</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Dépenses remboursées</p><p className="mt-1 text-xl font-semibold">{paidExpenses.toFixed(2)} $</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Achats</p><p className="mt-1 text-xl font-semibold">{purchases.toFixed(2)} $</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Ventes / Sorties</p><p className="mt-1 text-xl font-semibold">{sales.toFixed(2)} $</p></div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche (membre / item)" className="w-[320px]" />
        <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as FilterType)}>
          <option value="all">Tous les types</option>
          <option value="expense">Dépense</option>
          <option value="purchase">Achat</option>
          <option value="sale">Vente / Sortie</option>
        </select>
        <select className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value as FilterCategory)}>
          <option value="all">Toutes catégories</option>
          <option value="objects">Objets</option>
          <option value="weapons">Armes</option>
          <option value="equipment">Équipement</option>
          <option value="drugs">Drogues</option>
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-white/70"><tr><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Catégorie</th><th className="px-4 py-3 text-left">Item / Membre</th><th className="px-4 py-3 text-left">Qté</th><th className="px-4 py-3 text-left">Montant</th><th className="px-4 py-3 text-left">Date</th></tr></thead>
          <tbody className="divide-y divide-white/10">
            {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-white/60">Chargement…</td></tr> : null}
            {!loading && filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-white/60">Aucun mouvement.</td></tr> : null}
            {!loading
              ? filtered.map((entry) => (
                  <tr key={`${entry.source}:${entry.id}`} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs">
                        {entry.movement_type === 'expense' ? <Receipt className="h-3 w-3" /> : entry.movement_type === 'purchase' ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {typeLabels[entry.movement_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">{categoryLabels[entry.category] || 'Autre'}</td>
                    <td className="px-4 py-3"><div className="font-semibold">{entry.item_label}</div>{entry.member_name ? <div className="text-xs text-white/60">{entry.member_name}</div> : null}</td>
                    <td className="px-4 py-3">{entry.quantity}</td>
                    <td className="px-4 py-3">{entry.amount == null ? '—' : `${Number(entry.amount).toFixed(2)} $`}</td>
                    <td className="px-4 py-3 text-white/70">{new Date(entry.created_at).toLocaleString()}</td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">❌ {error}</div> : null}
      <p className="mt-4 text-xs text-white/55"><Wallet className="mr-1 inline h-3 w-3" />Le total global affiché dépend du filtre courant.</p>
    </Panel>
  )
}
