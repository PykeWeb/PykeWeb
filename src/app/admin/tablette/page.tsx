'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { TabletRentalTicket } from '@/lib/tabletRental'
import type { AdminTabletAtelierStatsResponse } from '@/lib/types/tablette'

type AdminRentalTicket = TabletRentalTicket & { group_name?: string | null; group_badge?: string | null }

export default function AdminTablettePage() {
  const [rows, setRows] = useState<AdminRentalTicket[]>([])
  const [stats, setStats] = useState<AdminTabletAtelierStatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function refresh() {
    const [rentalsRes, statsRes] = await Promise.all([
      fetch('/api/admin/tablette/rentals', withTenantSessionHeader({ cache: 'no-store' })),
      fetch('/api/admin/tablette/atelier', withTenantSessionHeader({ cache: 'no-store' })),
    ])

    if (!rentalsRes.ok) {
      setError(await rentalsRes.text())
      return
    }

    if (!statsRes.ok) {
      setError(await statsRes.text())
      return
    }

    const rentalsJson = (await rentalsRes.json()) as AdminRentalTicket[]
    const statsJson = (await statsRes.json()) as AdminTabletAtelierStatsResponse

    setRows(rentalsJson)
    setStats(statsJson)
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

  async function resetAllTabletRuns() {
    try {
      setResetting(true)
      const res = await fetch('/api/admin/tablette/atelier', {
        ...withTenantSessionHeader(),
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(await res.text())
      setResetOpen(false)
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reset tablette impossible')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Admin • Tablette</h1>
            <p className="mt-1 text-sm text-white/70">Stats d’utilisation, reset global et validation des preuves d’achat.</p>
          </div>
          <PrimaryButton onClick={() => setResetOpen(true)}>Reset tablettes (tous groupes)</PrimaryButton>
        </div>
      </Panel>

      {stats ? (
        <Panel>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Stats atelier tablette</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/60">Aujourd’hui ({stats.today})</p>
                <p className="text-sm">Passages: <span className="font-semibold">{stats.totals.runs_today}</span></p>
                <p className="text-sm">Items: <span className="font-semibold">{stats.totals.items_today}</span></p>
                <p className="text-sm">Coût: <span className="font-semibold">{stats.totals.cost_today.toFixed(2)} $</span></p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/60">Semaine en cours</p>
                <p className="text-sm">Passages: <span className="font-semibold">{stats.totals.runs_week}</span></p>
                <p className="text-sm">Items: <span className="font-semibold">{stats.totals.items_week}</span></p>
                <p className="text-sm">Coût: <span className="font-semibold">{stats.totals.cost_week.toFixed(2)} $</span></p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-white/60">Membres observés</p>
                <p className="text-sm">Total: <span className="font-semibold">{stats.by_member.length}</span></p>
                <p className="text-sm">Ont fait aujourd’hui: <span className="font-semibold">{stats.by_member.filter((m) => m.did_today).length}</span></p>
                <p className="text-sm">N’ont pas fait aujourd’hui: <span className="font-semibold">{stats.by_member.filter((m) => !m.did_today).length}</span></p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="mb-2 text-sm font-semibold">Par jour (14 derniers jours)</p>
                <div className="space-y-1 text-xs text-white/80">
                  {stats.by_day.map((row) => (
                    <div key={row.day_key} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                      <span>{row.day_key}</span>
                      <span>{row.runs} passages · {row.total_items} items · {row.total_cost.toFixed(2)} $</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="mb-2 text-sm font-semibold">Par semaine (8 dernières semaines)</p>
                <div className="space-y-1 text-xs text-white/80">
                  {stats.by_week.map((row) => (
                    <div key={row.week_key} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                      <span>{row.week_key}</span>
                      <span>{row.runs} passages · {row.total_items} items · {row.total_cost.toFixed(2)} $</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="mb-2 text-sm font-semibold">Qui l’a fait / pas fait aujourd’hui</p>
                <div className="max-h-64 space-y-1 overflow-auto text-xs text-white/80">
                  {stats.by_member.map((row) => (
                    <div key={row.member_name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                      <span className="font-medium">{row.member_name}</span>
                      <span className={row.did_today ? 'text-emerald-200' : 'text-amber-200'}>{row.did_today ? 'fait aujourd’hui' : 'pas fait aujourd’hui'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="mb-2 text-sm font-semibold">Par groupe (aujourd’hui)</p>
                <div className="max-h-64 space-y-1 overflow-auto text-xs text-white/80">
                  {stats.by_group_today.map((row) => (
                    <div key={row.group_id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                      <span className="font-medium">{row.group_name}</span>
                      <span>{row.runs_today} passages · {row.items_today} items</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <h2 className="text-lg font-semibold">Preuves d’achat tablette</h2>
        <p className="mt-1 text-sm text-white/70">Validation des virements et ajout automatique de durée d’accès.</p>
        <div className="mt-3 space-y-3">
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

      <ConfirmDialog
        open={resetOpen}
        title="Réinitialiser toutes les tablettes ?"
        description="Cette action supprime l’historique tablette (tous groupes) pour repartir à zéro."
        confirmLabel="Réinitialiser"
        loading={resetting}
        onCancel={() => setResetOpen(false)}
        onConfirm={resetAllTabletRuns}
      />
    </div>
  )
}
