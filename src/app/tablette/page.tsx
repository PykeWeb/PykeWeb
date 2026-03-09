'use client'

import { useEffect, useMemo, useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import type { TabletCatalogItemConfig, TabletDailyRun } from '@/lib/types/tablette'

type AtelierResponse = {
  today: string
  items: TabletCatalogItemConfig[]
  runs: TabletDailyRun[]
}

function formatDay(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR')
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR')
}

export default function TablettePage() {
  const [memberName, setMemberName] = useState('')
  const [disqueuseQty, setDisqueuseQty] = useState(0)
  const [kitCambusQty, setKitCambusQty] = useState(0)
  const [items, setItems] = useState<TabletCatalogItemConfig[]>([])
  const [runs, setRuns] = useState<TabletDailyRun[]>([])
  const [today, setToday] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const disqueusePrice = items.find((item) => item.key === 'disqueuse')?.unit_price ?? 150
  const kitCambusPrice = items.find((item) => item.key === 'kit_cambus')?.unit_price ?? 50
  const totalQty = disqueuseQty + kitCambusQty
  const totalCost = totalQty > 0 ? disqueuseQty * disqueusePrice + kitCambusQty * kitCambusPrice : 0

  const canSubmit = memberName.trim().length > 0 && totalQty > 0 && !saving

  const doneTodayByMember = useMemo(() => {
    const normalized = memberName.trim().toLowerCase()
    if (!normalized) return false
    return runs.some((row) => row.day_key === today && row.member_name.trim().toLowerCase() === normalized)
  }, [memberName, runs, today])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tablette/atelier', withTenantSessionHeader({ cache: 'no-store' }))
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'Impossible de charger la tablette.')
      }
      const data = (await res.json()) as AtelierResponse
      setItems(data.items)
      setRuns(data.runs)
      setToday(data.today)
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger la tablette.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <Panel>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Tablette</h1>
          <p className="text-sm text-white/60">Quota journalier par membre (00:00 → 00:00). Un membre ne peut valider qu’une fois par jour.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-white/60">Nom du membre</label>
              <Input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="Ex: Moussa" />
              {doneTodayByMember ? <p className="mt-1 text-xs text-amber-200">Ce membre a déjà validé aujourd’hui.</p> : null}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-sm font-semibold">Disqueuse</p>
              <p className="text-xs text-white/60">{disqueusePrice.toFixed(2)} $ · max 2 / jour</p>
              <div className="mt-3">
                <QuantityStepper value={disqueuseQty} onChange={setDisqueuseQty} min={0} max={2} />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-sm font-semibold">Kit de Cambus</p>
              <p className="text-xs text-white/60">{kitCambusPrice.toFixed(2)} $ · max 2 / jour</p>
              <div className="mt-3">
                <QuantityStepper value={kitCambusQty} onChange={setKitCambusQty} min={0} max={2} />
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">Jour: <span className="font-semibold">{formatDay(today)}</span></div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">Quantité totale: <span className="font-semibold">{totalQty}</span></div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">Coût total: <span className="font-semibold">{totalCost.toFixed(2)} $</span></div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton
              disabled={!canSubmit || doneTodayByMember}
              onClick={async () => {
                setSaving(true)
                setError(null)
                setSuccess(null)
                try {
                  const res = await fetch('/api/tablette/atelier', {
                    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
                    method: 'POST',
                    body: JSON.stringify({ member_name: memberName, disqueuse_qty: disqueuseQty, kit_cambus_qty: kitCambusQty }),
                  })

                  if (!res.ok) {
                    const payload = (await res.json().catch(() => null)) as { error?: string } | null
                    throw new Error(payload?.error || 'Validation impossible.')
                  }

                  setDisqueuseQty(0)
                  setKitCambusQty(0)
                  setSuccess('Tablette validée et items ajoutés au catalogue.')
                  await load()
                } catch (submitError: unknown) {
                  setError(submitError instanceof Error ? submitError.message : 'Validation impossible.')
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? 'Validation…' : 'Valider la tablette'}
            </PrimaryButton>
            <SecondaryButton onClick={() => { setDisqueuseQty(0); setKitCambusQty(0) }}>Réinitialiser</SecondaryButton>
          </div>

          {error ? <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
          {success ? <p className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{success}</p> : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-base font-semibold">Récapitulatif</h2>
          <p className="mb-3 text-xs text-white/60">Historique des membres ayant fait la tablette.</p>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-white/70">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Membre</th>
                  <th className="px-3 py-2 text-left">Disqueuse</th>
                  <th className="px-3 py-2 text-left">Kit de Cambus</th>
                  <th className="px-3 py-2 text-left">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-white/60">Chargement…</td></tr>
                ) : runs.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-white/60">Aucun passage tablette.</td></tr>
                ) : (
                  runs.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 text-white/70">{formatDateTime(row.created_at)}</td>
                      <td className="px-3 py-2 font-medium">{row.member_name}</td>
                      <td className="px-3 py-2">{row.disqueuse_qty}</td>
                      <td className="px-3 py-2">{row.kit_cambus_qty}</td>
                      <td className="px-3 py-2">{Number(row.total_cost).toFixed(2)} $</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Panel>
  )
}
