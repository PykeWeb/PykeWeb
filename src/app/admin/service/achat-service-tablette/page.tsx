'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { GlassSelect } from '@/components/ui/GlassSelect'
import type { TabletRentalTicket } from '@/lib/tabletRental'

type AdminRentalTicket = TabletRentalTicket & { group_name?: string | null; group_badge?: string | null }

export default function AdminServiceAchatTablettePage() {
  const [rows, setRows] = useState<AdminRentalTicket[]>([])
  const [error, setError] = useState<string | null>(null)
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [serviceCategory, setServiceCategory] = useState<'all' | 'pending' | 'resolved'>('all')

  const filteredRows = useMemo(() => {
    if (serviceCategory === 'all') return rows
    return rows.filter((row) => (serviceCategory === 'pending' ? row.status !== 'resolved' : row.status === 'resolved'))
  }, [rows, serviceCategory])

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/tablette/rentals', withTenantSessionHeader({ cache: 'no-store' }))
    if (!res.ok) {
      setError(await res.text())
      return
    }
    const json = (await res.json()) as AdminRentalTicket[]
    setRows(json)
    setError(null)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function validateRow(row: AdminRentalTicket) {
    try {
      setValidatingId(row.id)
      const res = await fetch('/api/admin/tablette/rentals', {
        ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
        method: 'PATCH',
        body: JSON.stringify({ id: row.id, group_id: row.group_id, weeks: row.weeks }),
      })
      if (!res.ok) throw new Error(await res.text())
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Validation impossible')
    } finally {
      setValidatingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Catégorie Service</p>
            <h1 className="text-2xl font-semibold">Achat service tablette</h1>
            <p className="mt-1 text-sm text-white/70">Validation des preuves d’achat du service tablette.</p>
          </div>
          <GlassSelect
            value={serviceCategory}
            onChange={(value) => setServiceCategory(value as 'all' | 'pending' | 'resolved')}
            options={[
              { value: 'all', label: `Tous (${rows.length})` },
              { value: 'pending', label: `En attente (${rows.filter((row) => row.status !== 'resolved').length})` },
              { value: 'resolved', label: `Validés (${rows.filter((row) => row.status === 'resolved').length})` },
            ]}
            className="w-full md:w-[280px]"
          />
        </div>
      </Panel>

      <Panel>
        <div className="space-y-3">
          {filteredRows.map((row) => (
            <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="mb-1 inline-flex rounded-full border border-cyan-300/30 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-100">Service</p>
                  <p className="font-semibold">{row.group_name || row.group_id} {row.group_badge ? `(${row.group_badge})` : ''}</p>
                  <p className="text-xs text-white/60">{row.weeks} semaine(s) · {row.amount.toFixed(2)} $</p>
                </div>
                {row.status !== 'resolved' ? (
                  <PrimaryButton disabled={validatingId === row.id} onClick={() => void validateRow(row)}>Valider</PrimaryButton>
                ) : (
                  <SecondaryButton disabled>Déjà validé</SecondaryButton>
                )}
              </div>

              {row.image_url ? (
                <button type="button" className="mt-2" onClick={() => setPreviewImageUrl(row.image_url || null)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.image_url} alt="Preuve" className="h-28 w-auto rounded-lg border border-white/10 object-cover transition hover:opacity-90" />
                </button>
              ) : null}
            </div>
          ))}

          {filteredRows.length === 0 ? <p className="text-sm text-white/60">Aucune preuve dans cette catégorie.</p> : null}
        </div>
      </Panel>

      {error ? <p className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      {previewImageUrl ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPreviewImageUrl(null)}>
          <div className="max-h-[90vh] max-w-[90vw]" onClick={(event) => event.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImageUrl} alt="Preuve en grand" className="max-h-[90vh] max-w-[90vw] rounded-xl border border-white/10 object-contain" />
            <div className="mt-3 flex justify-end">
              <SecondaryButton onClick={() => setPreviewImageUrl(null)}>Fermer</SecondaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
