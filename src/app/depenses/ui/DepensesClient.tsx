'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Trash2 } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { deleteExpense, listExpenses, setExpenseStatus, type DbExpense } from '@/lib/expensesApi'
import { PrimaryButton, SearchInput, SecondaryButton } from '@/components/ui/design-system'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from 'sonner'

function badge(status: string) {
  if (status === 'paid')
    return (
      <span className="inline-flex h-8 items-center gap-1 rounded-full border border-emerald-300/35 bg-emerald-400/10 px-3 text-sm font-semibold text-emerald-200">
        <CheckCircle2 className="h-4 w-4" /> Remboursé
      </span>
    )
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full border border-amber-300/35 bg-amber-400/10 px-3 text-sm font-semibold text-amber-200">
      <Clock3 className="h-4 w-4" /> En attente
    </span>
  )
}

export default function DepensesClient({
  newExpenseHref = '/depenses/nouveau',
  backHref,
  title,
}: {
  newExpenseHref?: string
  backHref?: string
  title?: string
} = {}) {
  const [items, setItems] = useState<DbExpense[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DbExpense | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      setItems(await listExpenses())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((e) => (e.member_name || '').toLowerCase().includes(q) || (e.item_label || '').toLowerCase().includes(q))
  }, [items, query])

  const pendingSum = useMemo(() => filtered.filter((e) => e.status !== 'paid').reduce((s, e) => s + (e.total || 0), 0), [filtered])
  const paidSum = useMemo(() => filtered.filter((e) => e.status === 'paid').reduce((s, e) => s + (e.total || 0), 0), [filtered])

  async function onDeleteExpense() {
    if (!pendingDelete) return
    try {
      setDeleting(true)
      await deleteExpense(pendingDelete.id)
      await refresh()
      toast.success('Dépense supprimée.')
      setPendingDelete(null)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Impossible de supprimer la dépense.'
      setError(message)
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="text-lg font-semibold">{title}</h2> : <div />}
          <div className="flex items-center gap-2">
            {backHref ? (
              <Link href={backHref}>
                <SecondaryButton size="lg">Retour</SecondaryButton>
              </Link>
            ) : null}
            <Link href={newExpenseHref}>
              <PrimaryButton size="lg">Ajouter une dépense</PrimaryButton>
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} className="w-[300px]" placeholder="Rechercher (membre / item)…" />
          <div className="text-sm text-white/60">{filtered.length} dépense(s)</div>
          <div className="ml-auto flex items-center gap-4 text-sm text-white/70">
            <span>
              En attente : <span className="font-semibold">{pendingSum.toFixed(2)} $</span>
            </span>
            <span>
              Remboursé : <span className="font-semibold">{paidSum.toFixed(2)} $</span>
            </span>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-white/70">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Membre</th>
                <th className="px-4 py-3 text-left font-medium">Item</th>
                <th className="px-4 py-3 text-left font-medium">Qté</th>
                <th className="px-4 py-3 text-left font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/60">
                    Chargement…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/60">
                    Aucune dépense pour le moment.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{e.member_name}</div>
                      <div className="text-xs text-white/50">{new Date(e.created_at).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{e.item_label}</div>
                      {e.description ? <div className="text-xs text-white/60 line-clamp-1">{e.description}</div> : null}
                      {e.proof_image_url ? (
                        <a href={e.proof_image_url} target="_blank" className="text-xs text-white/60 underline underline-offset-2">
                          Voir preuve
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{e.quantity}</td>
                    <td className="px-4 py-3">{Number(e.total).toFixed(2)} $</td>
                    <td className="px-4 py-3">{badge(e.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <SecondaryButton
                          disabled={busyId === e.id}
                          onClick={async () => {
                            setBusyId(e.id)
                            setError(null)
                            try {
                              await setExpenseStatus({ expenseId: e.id, status: e.status === 'paid' ? 'pending' : 'paid' })
                              await refresh()
                            } catch (err: any) {
                              setError(err?.message || 'Erreur')
                            } finally {
                              setBusyId(null)
                            }
                          }}
                        >
                          {e.status === 'paid' ? 'Remettre en attente' : 'Rembourser'}
                        </SecondaryButton>
                        <SecondaryButton type="button" disabled={busyId === e.id} onClick={() => setPendingDelete(e)} icon={<Trash2 className="h-4 w-4" />}>
                          Supprimer
                        </SecondaryButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">❌ {error}</div> : null}
      </Panel>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Supprimer cette dépense ?"
        description="Cette action est définitive et retire la ligne de la comptabilité."
        loading={deleting}
        onCancel={() => (!deleting ? setPendingDelete(null) : null)}
        onConfirm={onDeleteExpense}
      />
    </div>
  )
}
