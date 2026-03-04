'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Pencil, Receipt, Trash2, Wallet } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { PrimaryButton, SearchInput, SecondaryButton, TabPill } from '@/components/ui/design-system'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { listFinanceEntries, type FinanceCategory, type FinanceEntry, type FinanceMovementType } from '@/lib/financeApi'
import { createFinanceTransaction } from '@/lib/itemsApi'
import { FinanceItemTradeModal } from '@/components/ui/FinanceItemTradeModal'
import { toast } from 'sonner'
import { copy } from '@/lib/copy'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { deleteExpense, setExpenseStatus, updateExpense, type ExpenseStatus } from '@/lib/expensesApi'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

type FilterType = 'all' | FinanceMovementType
type FilterCategory = 'all' | FinanceCategory

type EditableExpense = {
  id: string
  member_name: string
  item_label: string
  quantity: number
  unit_price: number
  description: string
  status: ExpenseStatus
}

const typeLabels: Record<FinanceMovementType, string> = { expense: 'Dépense', purchase: 'Achat', sale: 'Vente/Sortie' }
const categoryLabels: Record<FinanceCategory, string> = { objects: 'Objets', weapons: 'Armes', equipment: 'Équipement', drugs: 'Drogues', custom: 'Custom', other: 'Autre' }

function toPositiveInt(value: string, fallback = 1) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.floor(parsed))
}

function toNonNegativeNumber(value: string, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, parsed)
}

function isExpenseEntry(entry: FinanceEntry) {
  return entry.source === 'expenses' && entry.movement_type === 'expense'
}

function statusBadge(status: ExpenseStatus | null | undefined) {
  if (status === 'paid') {
    return <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-100">Remboursé</span>
  }
  return <span className="inline-flex rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-100">En attente</span>
}

export default function FinanceClient() {
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState<FilterType>('all')
  const [category, setCategory] = useState<FilterCategory>('all')
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell' | null>(null)
  const [selectedCounterparty, setSelectedCounterparty] = useState<string | null>(null)
  const [busyExpenseId, setBusyExpenseId] = useState<string | null>(null)
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<EditableExpense | null>(null)
  const [editingQuantity, setEditingQuantity] = useState('1')
  const [editingUnitPrice, setEditingUnitPrice] = useState('0')

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

  const editingTotal = useMemo(() => toPositiveInt(editingQuantity) * toNonNegativeNumber(editingUnitPrice), [editingQuantity, editingUnitPrice])

  return (
    <Panel>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Dépenses en attente</p><p className="mt-1 text-xl font-semibold">{pendingExpenses.toFixed(2)} $</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Dépenses remboursées</p><p className="mt-1 text-xl font-semibold">{paidExpenses.toFixed(2)} $</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Achats</p><p className="mt-1 text-xl font-semibold">{purchases.toFixed(2)} $</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Ventes / Sorties</p><p className="mt-1 text-xl font-semibold">{sales.toFixed(2)} $</p></div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <SearchInput value={q} onChange={(e) => { setQ(e.target.value); setSelectedCounterparty(null) }} placeholder="Recherche (item / interlocuteur / note)" className="w-[360px]" />
        <GlassSelect value={category} onChange={(v) => setCategory(v as FilterCategory)} options={[{ value: 'all', label: 'Toutes catégories' }, { value: 'objects', label: 'Objets' }, { value: 'weapons', label: 'Armes' }, { value: 'equipment', label: 'Équipement' }, { value: 'drugs', label: 'Drogues' }, { value: 'custom', label: 'Custom' }]} />
        <Link href="/finance/depense/nouveau"><SecondaryButton>Nouvelle dépense</SecondaryButton></Link>
        <PrimaryButton onClick={() => setTradeMode('buy')}>Achat / Vente</PrimaryButton>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TabPill active={type === 'all'} onClick={() => setType('all')}>Tous les types</TabPill>
        <TabPill active={type === 'expense'} onClick={() => setType('expense')}>Dépense</TabPill>
        <TabPill active={type === 'purchase'} onClick={() => setType('purchase')}>Achat</TabPill>
        <TabPill active={type === 'sale'} onClick={() => setType('sale')}>Vente</TabPill>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-white/70"><tr><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Catégorie</th><th className="px-4 py-3 text-left">Item / Interlocuteur</th><th className="px-4 py-3 text-left">Qté</th><th className="px-4 py-3 text-left">Montant</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-white/10">
            {loading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-white/60">Chargement…</td></tr> : null}
            {!loading && filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-white/60">Aucun mouvement.</td></tr> : null}
            {!loading ? filtered.map((entry) => {
              const canManageExpense = isExpenseEntry(entry)
              return (
                <tr key={`${entry.source}:${entry.id}`} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs">{entry.movement_type === 'expense' ? <Receipt className="h-3 w-3" /> : entry.movement_type === 'purchase' ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}{typeLabels[entry.movement_type]}</span></td>
                  <td className="px-4 py-3">{categoryLabels[entry.category] || 'Autre'}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{entry.item_label}</div>
                    {entry.member_name ? <div className="text-xs text-white/60">Interlocuteur: {entry.member_name}</div> : null}
                    {canManageExpense ? <div className="mt-1">{statusBadge(entry.expense_status)}</div> : null}
                    {entry.notes ? <div className="text-xs text-white/50 line-clamp-1">{entry.notes}</div> : null}
                  </td>
                  <td className="px-4 py-3">{entry.quantity}</td>
                  <td className="px-4 py-3">{entry.amount == null ? '—' : `${Number(entry.amount).toFixed(2)} $`}</td>
                  <td className="px-4 py-3 text-white/70">{new Date(entry.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {canManageExpense ? (
                      <div className="flex justify-end gap-2">
                        <SecondaryButton
                          disabled={busyExpenseId === entry.id}
                          onClick={async () => {
                            setBusyExpenseId(entry.id)
                            setError(null)
                            try {
                              const nextStatus: ExpenseStatus = entry.expense_status === 'paid' ? 'pending' : 'paid'
                              await setExpenseStatus({ expenseId: entry.id, status: nextStatus })
                              toast.success(nextStatus === 'paid' ? 'Dépense remboursée.' : 'Dépense repassée en attente.')
                              await refresh()
                            } catch (err: unknown) {
                              setError(err instanceof Error ? err.message : 'Impossible de modifier le statut')
                            } finally {
                              setBusyExpenseId(null)
                            }
                          }}
                        >
                          {entry.expense_status === 'paid' ? 'Attente' : 'Rembourser'}
                        </SecondaryButton>
                        <SecondaryButton
                          disabled={busyExpenseId === entry.id}
                          icon={<Pencil className="h-4 w-4" />}
                          onClick={() => {
                            const unit = Number(entry.expense_unit_price ?? (entry.amount ?? 0) / Math.max(1, entry.quantity))
                            setEditingExpense({
                              id: entry.id,
                              member_name: entry.member_name || '',
                              item_label: entry.item_label,
                              quantity: Math.max(1, entry.quantity || 1),
                              unit_price: Number.isFinite(unit) ? unit : 0,
                              description: entry.notes || '',
                              status: entry.expense_status === 'paid' ? 'paid' : 'pending',
                            })
                            setEditingQuantity(String(Math.max(1, entry.quantity || 1)))
                            setEditingUnitPrice(String(Number.isFinite(unit) ? unit : 0))
                          }}
                        >
                          Modifier
                        </SecondaryButton>
                        <SecondaryButton disabled={busyExpenseId === entry.id} icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteExpenseId(entry.id)}>
                          Supprimer
                        </SecondaryButton>
                      </div>
                    ) : (
                      <div className="text-right text-xs text-white/40">—</div>
                    )}
                  </td>
                </tr>
              )
            }) : null}
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

      {editingExpense ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl">
            <Panel>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">Modifier la dépense</h3>
                <SecondaryButton onClick={() => setEditingExpense(null)}>Fermer</SecondaryButton>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-white/60">Membre</label>
                  <Input value={editingExpense.member_name} onChange={(e) => setEditingExpense((prev) => (prev ? { ...prev, member_name: e.target.value } : prev))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/60">Item</label>
                  <Input value={editingExpense.item_label} onChange={(e) => setEditingExpense((prev) => (prev ? { ...prev, item_label: e.target.value } : prev))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/60">Quantité</label>
                  <Input inputMode="numeric" value={editingQuantity} onChange={(e) => setEditingQuantity(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/60">Prix unitaire</label>
                  <Input inputMode="decimal" value={editingUnitPrice} onChange={(e) => setEditingUnitPrice(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-white/60">Description</label>
                  <Textarea value={editingExpense.description} onChange={(e) => setEditingExpense((prev) => (prev ? { ...prev, description: e.target.value } : prev))} className="min-h-[96px]" />
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <TabPill
                    active={editingExpense.status === 'pending'}
                    onClick={() => setEditingExpense((prev) => (prev ? { ...prev, status: 'pending' } : prev))}
                  >
                    En attente
                  </TabPill>
                  <TabPill
                    active={editingExpense.status === 'paid'}
                    onClick={() => setEditingExpense((prev) => (prev ? { ...prev, status: 'paid' } : prev))}
                  >
                    Remboursé
                  </TabPill>
                  <div className="ml-auto text-sm text-white/70">Total: <span className="font-semibold">{editingTotal.toFixed(2)} $</span></div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <SecondaryButton onClick={() => setEditingExpense(null)}>Annuler</SecondaryButton>
                <PrimaryButton
                  onClick={async () => {
                    if (!editingExpense) return
                    const quantity = toPositiveInt(editingQuantity)
                    const unitPrice = toNonNegativeNumber(editingUnitPrice)
                    if (!editingExpense.member_name.trim() || !editingExpense.item_label.trim()) {
                      toast.error('Membre et item sont obligatoires.')
                      return
                    }
                    setBusyExpenseId(editingExpense.id)
                    setError(null)
                    try {
                      await updateExpense({
                        expenseId: editingExpense.id,
                        member_name: editingExpense.member_name,
                        item_label: editingExpense.item_label,
                        quantity,
                        unit_price: unitPrice,
                        description: editingExpense.description,
                      })
                      await setExpenseStatus({ expenseId: editingExpense.id, status: editingExpense.status })
                      toast.success('Dépense modifiée.')
                      setEditingExpense(null)
                      await refresh()
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : 'Impossible de modifier la dépense.')
                    } finally {
                      setBusyExpenseId(null)
                    }
                  }}
                  disabled={busyExpenseId === editingExpense.id}
                >
                  Enregistrer
                </PrimaryButton>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleteExpenseId}
        title="Supprimer la dépense ?"
        description="Cette action est définitive."
        loading={!!busyExpenseId && busyExpenseId === deleteExpenseId}
        onCancel={() => setDeleteExpenseId(null)}
        onConfirm={async () => {
          if (!deleteExpenseId) return
          setBusyExpenseId(deleteExpenseId)
          setError(null)
          try {
            await deleteExpense(deleteExpenseId)
            toast.success('Dépense supprimée.')
            setDeleteExpenseId(null)
            await refresh()
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Impossible de supprimer la dépense.')
          } finally {
            setBusyExpenseId(null)
          }
        }}
      />

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
