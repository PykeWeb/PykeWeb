'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Layers3, Pencil, Receipt, Trash2, Wallet } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { PrimaryButton, SearchInput, SecondaryButton, TabPill } from '@/components/ui/design-system'
import { listFinanceEntries, type FinanceCategory, type FinanceEntry, type FinanceMovementType } from '@/lib/financeApi'
import { toast } from 'sonner'
import { copy } from '@/lib/copy'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { deleteExpense, setExpenseStatus, updateExpense, type ExpenseStatus } from '@/lib/expensesApi'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { getFinanceListImage } from '@/lib/financeVisuals'

type FilterType = 'all' | FinanceMovementType
type FilterCategory = 'all' | 'multi' | FinanceCategory

type EditableExpense = {
  id: string
  member_name: string
  item_label: string
  quantity: number
  unit_price: number
  description: string
  status: ExpenseStatus
}

type ExpenseActionEntry = FinanceEntry & {
  source: 'expenses'
  movement_type: 'expense'
}

const typeLabels: Record<FinanceMovementType, string> = { expense: 'Dépense', purchase: 'Achat', stock_in: 'Entrée', sale: 'Vente', stock_out: 'Sortie' }
const categoryLabels: Record<FinanceCategory, string> = { objects: 'Objets', weapons: 'Armes', equipment: 'Équipement', drugs: 'Drogues', custom: 'Autres', other: 'Autres' }

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

function isExpenseEntry(entry: FinanceEntry): entry is ExpenseActionEntry {
  return entry.source === 'expenses' && entry.movement_type === 'expense'
}

function statusBadge(status: ExpenseStatus | null | undefined) {
  if (status === 'paid') {
    return <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-100">Remboursé</span>
  }
  return <span className="inline-flex rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-100">En attente</span>
}


function formatDateOnly(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR')
}

export default function FinanceClient() {
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState<FilterType>('all')
  const [category, setCategory] = useState<FilterCategory>('all')
  const [busyExpenseId, setBusyExpenseId] = useState<string | null>(null)
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<EditableExpense | null>(null)
  const [expenseActionEntry, setExpenseActionEntry] = useState<ExpenseActionEntry | null>(null)
  const [editingQuantity, setEditingQuantity] = useState('1')
  const [editingUnitPrice, setEditingUnitPrice] = useState('0')
  const searchParams = useSearchParams()
  const router = useRouter()

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


  useEffect(() => {
    const categoryParam = searchParams.get('category')
    const typeParam = searchParams.get('type')
    if (categoryParam && ['multi', 'objects', 'weapons', 'equipment', 'drugs', 'custom', 'other'].includes(categoryParam)) {
      setCategory(categoryParam === 'custom' ? 'other' : (categoryParam as FilterCategory))
    }
    if (typeParam && ['expense', 'purchase', 'stock_in', 'sale', 'stock_out'].includes(typeParam)) {
      setType(typeParam as FilterType)
    }
  }, [searchParams])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return entries.filter((entry) => {
      if (type !== 'all' && entry.movement_type !== type) return false
      if (category === 'multi' && !entry.is_multi) return false
      if (category === 'other' && !['other', 'custom'].includes(entry.category)) return false
      if (category !== 'all' && category !== 'multi' && category !== 'other' && entry.category !== category) return false
      if (!query) return true
      return `${entry.item_label} ${entry.member_name || ''} ${entry.notes || ''}`.toLowerCase().includes(query)
    })
  }, [entries, q, type, category])

  const pendingExpenses = useMemo(() => filtered.filter((e) => e.movement_type === 'expense' && e.expense_status !== 'paid').reduce((s, e) => s + (e.amount || 0), 0), [filtered])
  const paidExpenses = useMemo(() => filtered.filter((e) => e.movement_type === 'expense' && e.expense_status === 'paid').reduce((s, e) => s + (e.amount || 0), 0), [filtered])
  const purchases = useMemo(() => filtered.filter((e) => e.movement_type === 'purchase').reduce((s, e) => s + (e.amount || 0), 0), [filtered])
  const stockIns = useMemo(() => filtered.filter((e) => e.movement_type === 'stock_in').length, [filtered])
  const sales = useMemo(() => filtered.filter((e) => e.movement_type === 'sale').reduce((s, e) => s + (e.amount || 0), 0), [filtered])
  const stockOuts = useMemo(() => filtered.filter((e) => e.movement_type === 'stock_out').length, [filtered])

  const editingTotal = useMemo(() => toPositiveInt(editingQuantity) * toNonNegativeNumber(editingUnitPrice), [editingQuantity, editingUnitPrice])

  function openEditExpense(entry: ExpenseActionEntry) {
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
  }

  return (
    <Panel>
      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Dépenses en attente</p><p className="mt-1 text-xl font-semibold">{pendingExpenses.toFixed(2)} $</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Dépenses remboursées</p><p className="mt-1 text-xl font-semibold">{paidExpenses.toFixed(2)} $</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Achats</p><p className="mt-1 text-xl font-semibold">{purchases.toFixed(2)} $</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Entrées</p><p className="mt-1 text-xl font-semibold">{stockIns}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Ventes</p><p className="mt-1 text-xl font-semibold">{sales.toFixed(2)} $</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/60">Sorties</p><p className="mt-1 text-xl font-semibold">{stockOuts}</p></div>
      </div>

      <div className="mt-4 mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/finance/depense/nouveau"><SecondaryButton>Nouvelle dépense</SecondaryButton></Link>
          <Link href="/finance/achat-vente"><SecondaryButton>Achat / Vente</SecondaryButton></Link>
          <Link href="/finance/stats-interlocuteurs"><SecondaryButton>Stats interlocuteurs</SecondaryButton></Link>
          <Link href="/finance/entree-sortie"><SecondaryButton>{copy.finance.stockFlow.stockInOutButton}</SecondaryButton></Link>
        </div>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Recherche (item / interlocuteur / note)"
          className="ml-auto w-full max-w-[140px]"
        />
      </div>

      <div className="mb-[10px] mt-1 flex flex-wrap items-center gap-2">
        <TabPill className="h-9 rounded-xl px-3 text-xs" active={type === 'all'} onClick={() => setType('all')}>Tous les types</TabPill>
        <TabPill className="h-9 rounded-xl px-3 text-xs" active={type === 'expense'} onClick={() => setType('expense')}>Dépense</TabPill>
        <TabPill className="h-9 rounded-xl px-3 text-xs" active={type === 'purchase'} onClick={() => setType('purchase')}>Achat</TabPill>
        <TabPill className="h-9 rounded-xl px-3 text-xs" active={type === 'stock_in'} onClick={() => setType('stock_in')}>Entrée</TabPill>
        <TabPill className="h-9 rounded-xl px-3 text-xs" active={type === 'sale'} onClick={() => setType('sale')}>Vente</TabPill>
        <TabPill className="h-9 rounded-xl px-3 text-xs" active={type === 'stock_out'} onClick={() => setType('stock_out')}>Sortie</TabPill>
      </div>

      <div className="mb-4 mt-4 flex flex-wrap items-center gap-2">
        <TabPill className="h-9 rounded-xl px-3 text-xs" active={category === 'all'} onClick={() => setCategory('all')}>Toutes catégories</TabPill>
        <TabPill className="h-9 rounded-xl px-3 text-xs" active={category === 'multi'} onClick={() => setCategory('multi')}>Multiple</TabPill>
        <TabPill className="h-9 rounded-xl px-3 text-xs" active={category === 'objects'} onClick={() => setCategory('objects')}>Objets</TabPill>
        <TabPill className="h-9 rounded-xl px-3 text-xs" active={category === 'weapons'} onClick={() => setCategory('weapons')}>Armes</TabPill>
        <TabPill className="h-9 rounded-xl px-3 text-xs" active={category === 'equipment'} onClick={() => setCategory('equipment')}>Équipement</TabPill>
        <TabPill className="h-9 rounded-xl px-3 text-xs" active={category === 'drugs'} onClick={() => setCategory('drugs')}>Drogues</TabPill>
        <TabPill className="h-9 rounded-xl px-3 text-xs" active={category === 'other'} onClick={() => setCategory('other')}>Autres</TabPill>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-white/70"><tr><th className="px-4 py-3 text-left">Image</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Catégorie</th><th className="px-4 py-3 text-left">Item</th><th className="px-4 py-3 text-left">Qté</th><th className="px-4 py-3 text-left">Montant</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Interlocuteur</th><th className="px-4 py-3 text-right"></th></tr></thead>
          <tbody className="divide-y divide-white/10">
            {loading ? <tr><td colSpan={9} className="px-4 py-8 text-center text-white/60">Chargement…</td></tr> : null}
            {!loading && filtered.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-white/60">Aucun mouvement.</td></tr> : null}
            {!loading ? filtered.map((entry) => {
              const canManageExpense = isExpenseEntry(entry)
              const listImageUrl = getFinanceListImage({
                movementType: entry.movement_type,
                category: entry.category,
                isMulti: entry.is_multi,
                itemImageUrl: entry.item_image_url,
              })
              return (
                <tr
                  key={`${entry.source}:${entry.id}`}
                  className="cursor-pointer hover:bg-white/[0.05]"
                  onClick={() => {
                    router.push(`/finance/transactions/${entry.source}/${encodeURIComponent(entry.id)}`)
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                      {listImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={listImageUrl} alt={entry.item_label} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[10px] text-white/40">IMG</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs">{entry.movement_type === 'expense' ? <Receipt className="h-3 w-3" /> : entry.movement_type === 'purchase' ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}{typeLabels[entry.movement_type]}</span></td>
                  <td className="px-4 py-3">{categoryLabels[entry.category] || 'Autre'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold">
                      <span>{entry.item_label}</span>
                      {entry.is_multi ? <Layers3 className="h-3.5 w-3.5 text-cyan-200" /> : null}
                    </div>
                    {entry.notes && !(entry.movement_type === 'expense' && entry.is_multi) ? <div className="text-xs text-white/50 line-clamp-1">{entry.notes}</div> : null}
                  </td>
                  <td className="px-4 py-3">{entry.quantity}</td>
                  <td className="px-4 py-3">{entry.amount == null ? '—' : `${Number(entry.amount).toFixed(2)} $`}</td>
                  <td className="px-4 py-3 text-white/70">{formatDateOnly(entry.created_at)}</td>
                  <td className="px-4 py-3 text-white/70">
                    <div className="flex items-center gap-2">
                      <span>{entry.member_name || '—'}</span>
                      {canManageExpense ? <span className="ml-3">{statusBadge(entry.expense_status)}</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              )
            }) : null}
          </tbody>
        </table>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">❌ {error}</div> : null}
      <p className="mt-4 text-xs text-white/55"><Wallet className="mr-1 inline h-3 w-3" />Le total global affiché dépend du filtre courant.</p>

      {expenseActionEntry ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={() => setExpenseActionEntry(null)}>
          <div className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
            <Panel>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-white/60">Gestion de dépense</p>
                  <h3 className="text-lg font-semibold">{expenseActionEntry.item_label}</h3>
                </div>
                <SecondaryButton onClick={() => setExpenseActionEntry(null)}>Fermer</SecondaryButton>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/75">
                <p>Interlocuteur: <span className="font-semibold text-white">{expenseActionEntry.member_name || '—'}</span></p>
                <p className="mt-1">Montant: <span className="font-semibold text-white">{Number(expenseActionEntry.amount || 0).toFixed(2)} $</span></p>
                <div className="mt-2">{statusBadge(expenseActionEntry.expense_status)}</div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <SecondaryButton
                  disabled={busyExpenseId === expenseActionEntry.id}
                  onClick={async () => {
                    const activeEntry = expenseActionEntry
                    setBusyExpenseId(activeEntry.id)
                    setError(null)
                    try {
                      const nextStatus: ExpenseStatus = activeEntry.expense_status === 'paid' ? 'pending' : 'paid'
                      await setExpenseStatus({ expenseId: activeEntry.id, status: nextStatus })
                      toast.success(nextStatus === 'paid' ? 'Dépense remboursée.' : 'Dépense repassée en attente.')
                      setExpenseActionEntry(null)
                      await refresh()
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : 'Impossible de modifier le statut')
                    } finally {
                      setBusyExpenseId(null)
                    }
                  }}
                >
                  {expenseActionEntry.expense_status === 'paid' ? 'Attente' : 'Rembourser'}
                </SecondaryButton>
                <SecondaryButton
                  disabled={busyExpenseId === expenseActionEntry.id}
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={() => {
                    openEditExpense(expenseActionEntry)
                    setExpenseActionEntry(null)
                  }}
                >
                  Modifier
                </SecondaryButton>
                <SecondaryButton
                  disabled={busyExpenseId === expenseActionEntry.id}
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => {
                    setDeleteExpenseId(expenseActionEntry.id)
                    setExpenseActionEntry(null)
                  }}
                >
                  Supprimer
                </SecondaryButton>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

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

    </Panel>
  )
}
