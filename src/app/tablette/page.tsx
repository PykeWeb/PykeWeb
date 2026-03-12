'use client'

import { Image as ImageIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import type { GroupTabletStats, TabletCatalogItemConfig, TabletDailyRun } from '@/lib/types/tablette'

type AtelierResponse = {
  today: string
  items: TabletCatalogItemConfig[]
  runs: TabletDailyRun[]
  stats: GroupTabletStats
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
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [items, setItems] = useState<TabletCatalogItemConfig[]>([])
  const [runs, setRuns] = useState<TabletDailyRun[]>([])
  const [stats, setStats] = useState<GroupTabletStats | null>(null)
  const [today, setToday] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const totalQty = useMemo(() => Object.values(quantities).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0), [quantities])
  const totalCost = useMemo(
    () =>
      items.reduce((sum, item) => {
        const qty = Math.max(0, Number(quantities[item.key]) || 0)
        return sum + qty * Math.max(0, Number(item.unit_price) || 0)
      }, 0),
    [items, quantities]
  )

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
      setStats(data.stats)
      setQuantities((prev) => {
        const next: Record<string, number> = {}
        for (const item of data.items) {
          next[item.key] = Math.max(0, Number(prev[item.key]) || 0)
        }
        return next
      })
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger la tablette.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function resetForm() {
    setMemberName('')
    setError(null)
    setSuccess(null)
    setQuantities(Object.fromEntries(items.map((item) => [item.key, 0])))
  }

  return (
    <Panel>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Tablette</h1>
          <p className="text-sm text-white/60">Quota journalier par membre (00:00 → 00:00). Un membre ne peut valider qu’une fois par jour.</p>
        </div>

        {stats ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm">Aujourd’hui: <span className="font-semibold">{stats.today.runs} passages</span></div>
            <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-sm">Items aujourd’hui: <span className="font-semibold">{stats.today.items}</span></div>
            <div className="rounded-xl border border-violet-300/25 bg-violet-500/10 p-3 text-sm">Semaine: <span className="font-semibold">{stats.week.runs} passages</span></div>
            <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm">Pas fait aujourd’hui: <span className="font-semibold">{stats.members.filter((m) => !m.did_today).length}</span></div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-white/60">Nom du membre</label>
              <Input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="Ex: Moussa" />
              {doneTodayByMember ? <p className="mt-1 text-xs text-amber-200">Ce membre a déjà validé aujourd’hui.</p> : null}
            </div>

            {items.map((item) => (
              <div key={item.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/15 bg-white/[0.04]">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-4 w-4" /></div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-white/60">{item.unit_price.toFixed(2)} $ · max {item.max_per_day} / jour</p>
                  </div>
                </div>
                <div className="mt-3">
                  <QuantityStepper
                    value={Math.max(0, Number(quantities[item.key]) || 0)}
                    onChange={(value) => setQuantities((prev) => ({ ...prev, [item.key]: Math.max(0, value) }))}
                    min={0}
                    max={Math.max(0, item.max_per_day)}
                  />
                </div>
              </div>
            ))}
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
                    body: JSON.stringify({ member_name: memberName, quantities }),
                  })

                  if (!res.ok) {
                    const payload = (await res.json().catch(() => null)) as { error?: string } | null
                    throw new Error(payload?.error || 'Validation impossible.')
                  }

                  resetForm()
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
            <SecondaryButton onClick={resetForm}>Réinitialiser</SecondaryButton>
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
                  <th className="px-3 py-2 text-left">Items</th>
                  <th className="px-3 py-2 text-left">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-white/60">Chargement…</td></tr>
                ) : runs.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-white/60">Aucun passage tablette.</td></tr>
                ) : (
                  runs.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 text-white/70">{formatDateTime(row.created_at)}</td>
                      <td className="px-3 py-2 font-medium">{row.member_name}</td>
                      <td className="px-3 py-2">{row.total_items}</td>
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
