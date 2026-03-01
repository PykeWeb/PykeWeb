'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Panel } from '@/components/ui/Panel'
import { PageHeader } from '@/components/PageHeader'
import { listTransactions, type DbTransaction } from '@/lib/transactionsApi'
import { ArrowDownRight, ArrowUpRight, Plus } from 'lucide-react'

function Badge({ type }: { type: DbTransaction['type'] }) {
  const isEntry = type === 'purchase'
  const label = isEntry ? 'Entrée' : 'Sortie'
  const Icon = type === 'purchase' ? ArrowDownRight : ArrowUpRight
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
        isEntry
          ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'
          : 'border-orange-300/40 bg-orange-500/10 text-orange-100'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

export default function TransactionsClient() {
  const [rows, setRows] = useState<DbTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const data = await listTransactions(50)
        if (!cancelled) setRows(data)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Erreur de chargement')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const total = useMemo(() => rows.length, [rows])

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Achats (entrée stock) et sorties (vente / transfert)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/transactions/nouveau?type=purchase"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 shadow-glow hover:bg-white/10"
            >
              <Plus className="h-4 w-4" />
              Nouvel achat
            </Link>
            <Link
              href="/transactions/nouveau?type=sale"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 shadow-glow hover:bg-white/10"
            >
              <Plus className="h-4 w-4" />
              Nouvelle sortie
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4">
        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Historique</p>
              <p className="mt-1 text-lg font-semibold">Dernières transactions ({total})</p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Interlocuteur</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr>
                    <td className="px-4 py-4 text-white/60" colSpan={5}>
                      Chargement…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td className="px-4 py-4 text-rose-200" colSpan={5}>
                      {error}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-white/60" colSpan={5}>
                      Aucune transaction pour le moment.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5">
                      <td className="px-4 py-3">
                        <Badge type={r.type} />
                      </td>
                      <td className="px-4 py-3 text-white/80">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-white/80">{r.notes?.trim() ? r.notes : '—'}</td>
                      <td className="px-4 py-3 text-white/80">{r.counterparty ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-white/90">
                        {r.total == null ? '—' : `${Number(r.total).toFixed(2)} $`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  )
}
