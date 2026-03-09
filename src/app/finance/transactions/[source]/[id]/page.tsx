'use client'

import Link from 'next/link'
import { Image as ImageIcon, Layers3, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Panel } from '@/components/ui/Panel'
import { PrimaryButton, SecondaryButton, TabPill } from '@/components/ui/design-system'
import type { FinanceEntryDetailResponse, FinanceEntrySource } from '@/lib/types/financeDetail'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import type { ExpenseStatus } from '@/lib/expensesApi'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { toast } from 'sonner'

function formatMoney(value: number) {
  const normalized = Number.isFinite(value) ? value : 0
  return `${normalized.toFixed(2)} $`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR')
}

function movementLabel(source: FinanceEntrySource, movement: 'expense' | 'purchase' | 'sale') {
  if (source === 'expenses') return 'Dépense'
  return movement === 'sale' ? 'Vente' : 'Achat'
}

export default function FinanceTransactionDetailPage() {
  const params = useParams<{ source: FinanceEntrySource; id: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<FinanceEntryDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [itemLabel, setItemLabel] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('0')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<ExpenseStatus>('pending')

  const reloadDetail = useCallback(async () => {
    const res = await fetch(`/api/finance/entries/${params.source}/${params.id}`, withTenantSessionHeader({ cache: 'no-store' }))
    if (!res.ok) throw new Error(await res.text())
    const json = (await res.json()) as FinanceEntryDetailResponse
    setDetail(json)
    const current = json.entry

    setMemberName(current.counterparty || '')
    setItemLabel(current.display_name || '')
    setQuantity(String(Math.max(1, Math.floor(Number(current.quantity) || 1))))
    const lineUnit = current.lines[0]?.unit_price ?? 0
    setUnitPrice(String(Math.max(0, Number.isFinite(lineUnit) ? lineUnit : 0)))
    setNotes(current.notes || '')

    if (current.source === 'expenses') {
      setStatus(current.expense_status === 'paid' ? 'paid' : 'pending')
    }
  }, [params.id, params.source])

  useEffect(() => {
    async function load() {
      try {
        await reloadDetail()
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : 'Impossible de charger la transaction.')
      }
    }
    void load()
  }, [reloadDetail])

  const entry = detail?.entry
  const isExpense = entry?.source === 'expenses'
  const isFinanceTransaction = entry?.source === 'finance_transactions'
  const canEditQuantityAndPrice = isFinanceTransaction && !entry?.is_multi
  const expenseId = entry?.expense_id || entry?.id || null
  const parsedQuantity = Math.max(1, Math.floor(Number(quantity) || 1))
  const parsedUnitPrice = Math.max(0, Number(unitPrice) || 0)

  const totalItems = useMemo(() => {
    if (!entry) return 0
    return entry.lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0)
  }, [entry])

  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-white/60">Finance</p>
            <h1 className="text-2xl font-semibold">{entry?.display_name || 'Transaction'}</h1>
          </div>
          <Link href="/finance"><SecondaryButton>Retour</SecondaryButton></Link>
        </div>

        {error ? <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}

        {!entry ? (
          <p className="text-sm text-white/70">Chargement…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/60">Type</p>
                <p className="text-sm font-semibold">{movementLabel(entry.source, entry.movement_kind)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/60">Date</p>
                <p className="text-sm font-semibold">{formatDate(entry.created_at)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/60">Interlocuteur</p>
                <p className="text-sm font-semibold">{entry.counterparty || '—'}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/60">Total</p>
                <p className="text-sm font-semibold">{formatMoney(entry.total)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold">Détails des items</p>
                {entry.is_multi ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">
                    <Layers3 className="h-3.5 w-3.5" />
                    Transaction multiple ({entry.lines.length} lignes)
                  </span>
                ) : null}
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.03] text-white/70">
                    <tr>
                      <th className="px-3 py-2 text-left">Image</th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-left">Qté</th>
                      <th className="px-3 py-2 text-left">Prix unitaire</th>
                      <th className="px-3 py-2 text-left">Sous-total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {entry.lines.map((line, index) => (
                      <tr key={`${line.name}-${index}`}>
                        <td className="px-3 py-2">
                          <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                            {line.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={line.image_url} alt={line.name} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-white/40">
                                <ImageIcon className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-medium">{line.name}</td>
                        <td className="px-3 py-2">{line.quantity}</td>
                        <td className="px-3 py-2">{formatMoney(line.unit_price)}</td>
                        <td className="px-3 py-2">{formatMoney(line.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-white/80 md:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">Nombre de lignes: <span className="font-semibold text-white">{entry.lines.length}</span></div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">Quantité totale: <span className="font-semibold text-white">{totalItems}</span></div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">Montant total: <span className="font-semibold text-white">{formatMoney(entry.total)}</span></div>
              </div>
            </div>

            {entry.notes ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/60">Notes</p>
                <p className="mt-1 text-sm text-white/85">{entry.notes}</p>
              </div>
            ) : null}

            {isExpense ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Gestion de la dépense</p>
                  <div className="inline-flex items-center gap-2">
                    <TabPill active={status === 'pending'} onClick={() => setStatus('pending')}>En attente</TabPill>
                    <TabPill active={status === 'paid'} onClick={() => setStatus('paid')}>Remboursé</TabPill>
                  </div>
                </div>

                {editing ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-white/60">Interlocuteur</label>
                      <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-white/60">Item</label>
                      <Input value={itemLabel} onChange={(e) => setItemLabel(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-white/60">Quantité</label>
                      <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-white/60">Prix unitaire</label>
                      <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs text-white/60">Description</label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[96px]" />
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <SecondaryButton onClick={() => setEditing((prev) => !prev)} icon={<Pencil className="h-4 w-4" />}>{editing ? 'Fermer édition' : 'Modifier'}</SecondaryButton>
                  <PrimaryButton
                    disabled={busy || !expenseId || !memberName.trim() || !itemLabel.trim()}
                    onClick={async () => {
                      if (!expenseId) return
                      setBusy(true)
                      setError(null)
                      try {
                        const res = await fetch(`/api/finance/entries/expenses/${encodeURIComponent(expenseId)}`, {
                          ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
                          method: 'PATCH',
                          body: JSON.stringify({
                            member_name: memberName,
                            item_label: itemLabel,
                            quantity: parsedQuantity,
                            unit_price: parsedUnitPrice,
                            description: notes,
                            status,
                          }),
                        })
                        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Mise à jour impossible.')
                        toast.success('Dépense mise à jour.')
                        setEditing(false)
                        await reloadDetail()
                      } catch (actionError: unknown) {
                        setError(actionError instanceof Error ? actionError.message : 'Impossible de mettre à jour la dépense.')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Enregistrer changements
                  </PrimaryButton>
                  <SecondaryButton
                    disabled={busy || !expenseId}
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={async () => {
                      if (!expenseId) return
                      if (!window.confirm('Supprimer cette dépense ?')) return
                      setBusy(true)
                      try {
                        const res = await fetch(`/api/finance/entries/expenses/${encodeURIComponent(expenseId)}`, {
                          ...withTenantSessionHeader(),
                          method: 'DELETE',
                        })
                        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Suppression impossible.')
                        toast.success('Dépense supprimée.')
                        router.push('/finance')
                        router.refresh()
                      } catch (actionError: unknown) {
                        setError(actionError instanceof Error ? actionError.message : 'Impossible de supprimer la dépense.')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Supprimer
                  </SecondaryButton>
                </div>
              </div>
            ) : null}

            {!isExpense ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="mb-3 text-sm font-semibold">Gestion de la transaction</p>

                {editing ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-white/60">Interlocuteur</label>
                      <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-white/60">Notes</label>
                      <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-white/60">Quantité</label>
                      <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" disabled={!canEditQuantityAndPrice} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-white/60">Prix unitaire</label>
                      <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal" disabled={!canEditQuantityAndPrice} />
                    </div>
                    {!canEditQuantityAndPrice ? (
                      <p className="md:col-span-2 text-xs text-white/60">Pour les transactions legacy ou multiples, seule la note/interlocuteur est modifiable ici.</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <SecondaryButton onClick={() => setEditing((prev) => !prev)} icon={<Pencil className="h-4 w-4" />}>{editing ? 'Fermer édition' : 'Modifier'}</SecondaryButton>
                  <PrimaryButton
                    disabled={busy}
                    onClick={async () => {
                      if (!entry) return
                      setBusy(true)
                      setError(null)
                      try {
                        const payload: Record<string, unknown> = {
                          counterparty: memberName,
                          notes,
                        }
                        if (canEditQuantityAndPrice) {
                          payload.quantity = parsedQuantity
                          payload.unit_price = parsedUnitPrice
                        }

                        const res = await fetch(`/api/finance/entries/${entry.source}/${encodeURIComponent(entry.id)}`, {
                          ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
                          method: 'PATCH',
                          body: JSON.stringify(payload),
                        })
                        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Mise à jour impossible.')
                        toast.success('Transaction mise à jour.')
                        setEditing(false)
                        await reloadDetail()
                      } catch (actionError: unknown) {
                        setError(actionError instanceof Error ? actionError.message : 'Impossible de modifier la transaction.')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Enregistrer changements
                  </PrimaryButton>
                  <SecondaryButton
                    disabled={busy}
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={async () => {
                      if (!entry) return
                      if (!window.confirm('Supprimer cette transaction ?')) return
                      setBusy(true)
                      try {
                        const res = await fetch(`/api/finance/entries/${entry.source}/${encodeURIComponent(entry.id)}`, {
                          ...withTenantSessionHeader(),
                          method: 'DELETE',
                        })
                        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Suppression impossible.')
                        toast.success('Transaction supprimée.')
                        router.push('/finance')
                        router.refresh()
                      } catch (actionError: unknown) {
                        setError(actionError instanceof Error ? actionError.message : 'Impossible de supprimer la transaction.')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    Supprimer
                  </SecondaryButton>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  )
}
