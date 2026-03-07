'use client'

import Link from 'next/link'
import { Image as ImageIcon, Layers3 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Panel } from '@/components/ui/Panel'
import { SecondaryButton } from '@/components/ui/design-system'
import type { FinanceEntryDetailResponse, FinanceEntrySource } from '@/lib/types/financeDetail'
import { withTenantSessionHeader } from '@/lib/tenantRequest'

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
  const [detail, setDetail] = useState<FinanceEntryDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/finance/entries/${params.source}/${params.id}`,
          withTenantSessionHeader({ cache: 'no-store' })
        )
        if (!res.ok) throw new Error(await res.text())
        const json = (await res.json()) as FinanceEntryDetailResponse
        setDetail(json)
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : 'Impossible de charger la transaction.')
      }
    }
    void load()
  }, [params.id, params.source])

  const entry = detail?.entry

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
          </div>
        )}
      </Panel>
    </div>
  )
}
