'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Panel } from '@/components/ui/Panel'
import { SecondaryButton } from '@/components/ui/design-system'

type EntrySource = 'finance_transactions' | 'transactions' | 'expenses'

type DetailResponse = {
  source: EntrySource
  data: Record<string, unknown>
}

function formatMoney(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return `${number.toFixed(2)} $`
}

function formatDate(value: unknown) {
  const date = new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR')
}

export default function FinanceTransactionDetailPage() {
  const params = useParams<{ source: EntrySource; id: string }>()
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/finance/entries/${params.source}/${params.id}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(await res.text())
        const json = (await res.json()) as DetailResponse
        setDetail(json)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Impossible de charger la transaction.')
      }
    }
    void load()
  }, [params.id, params.source])

  const title = useMemo(() => {
    if (!detail) return 'Transaction'
    if (detail.source === 'transactions') return 'Achat / Sortie'
    if (detail.source === 'finance_transactions') return 'Transaction finance'
    return 'Dépense'
  }, [detail])

  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-white/60">Finance</p>
            <h1 className="text-2xl font-semibold">{title}</h1>
          </div>
          <Link href="/finance"><SecondaryButton>Retour</SecondaryButton></Link>
        </div>

        {error ? <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}

        {!detail ? (
          <p className="text-sm text-white/70">Chargement…</p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/60">ID</p>
                <p className="text-sm font-semibold">{String(detail.data.id || '—')}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/60">Date</p>
                <p className="text-sm font-semibold">{formatDate(detail.data.created_at)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/60">Interlocuteur</p>
                <p className="text-sm font-semibold">{String(detail.data.counterparty || detail.data.member_name || '—')}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/60">Total</p>
                <p className="text-sm font-semibold">{formatMoney(detail.data.total)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs text-white/60">Détails</p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-white/80">{JSON.stringify(detail.data, null, 2)}</pre>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
