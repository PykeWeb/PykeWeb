'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import type { TabletRentalTicket } from '@/lib/tabletRental'

type AdminRentalTicket = TabletRentalTicket & { group_name?: string | null; group_badge?: string | null }

export default function AdminTablettePage() {
  const [rows, setRows] = useState<AdminRentalTicket[]>([])
  const [error, setError] = useState<string | null>(null)
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  async function refresh() {
    const res = await fetch('/api/admin/tablette/rentals', withTenantSessionHeader({ cache: 'no-store' }))
    if (!res.ok) {
      setError(await res.text())
      return
    }
    const json = (await res.json()) as AdminRentalTicket[]
    setRows(json)
    setError(null)
  }

  useEffect(() => {
    void refresh()
  }, [])

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
        <h1 className="text-2xl font-semibold">Admin • Preuves d’achat tablette</h1>
        <p className="mt-1 text-sm text-white/70">Validation des virements et ajout automatique de durée d’accès.</p>
      </Panel>

      <Panel>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{row.group_name || row.group_id} {row.group_badge ? `(${row.group_badge})` : ''}</p>
                  <p className="text-xs text-white/60">{row.weeks} semaine(s) · {row.amount.toFixed(2)} $</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${row.status === 'resolved' ? 'border-emerald-300/35 bg-emerald-500/20 text-emerald-100' : 'border-amber-300/35 bg-amber-500/20 text-amber-100'}`}>
                    {row.status === 'resolved' ? 'Validé' : 'Pris en compte'}
                  </span>
                  {row.status !== 'resolved' ? (
                    <PrimaryButton disabled={validatingId === row.id} onClick={() => void validateRow(row)}>
                      Valider
                    </PrimaryButton>
                  ) : (
                    <SecondaryButton disabled>Déjà validé</SecondaryButton>
                  )}
                </div>
              </div>
              {row.image_url ? (
                <button type="button" className="mt-2" onClick={() => setPreviewImageUrl(row.image_url || null)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.image_url} alt="Preuve" className="h-28 w-auto rounded-lg border border-white/10 object-cover transition hover:opacity-90" />
                </button>
              ) : null}
            </div>
          ))}
          {rows.length === 0 ? <p className="text-sm text-white/60">Aucune preuve reçue.</p> : null}
        </div>
        {error ? <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      </Panel>

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
