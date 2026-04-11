'use client'

import { Image as ImageIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { PrimaryButton } from '@/components/ui/design-system'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { MemberSelect } from '@/components/ui/MemberSelect'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import { clearTenantSession, clearTenantSessionOnServer, getTenantSession, saveTenantSession } from '@/lib/tenantSession'
import type { GroupTabletStats, TabletCatalogItemConfig, TabletDailyBudget, TabletDailyRun } from '@/lib/types/tablette'
import { ActivitiesCategoryTabs } from '@/components/activities/ActivitiesCategoryTabs'
import { expandAccessPrefixes } from '@/lib/types/groupRoles'

type AtelierResponse = {
  today: string
  items: TabletCatalogItemConfig[]
  stock_by_key?: Record<string, number>
  runs: TabletDailyRun[]
  stats: GroupTabletStats
  budget: TabletDailyBudget | null
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
  const [stockByKey, setStockByKey] = useState<Record<string, number>>({})
  const [runs, setRuns] = useState<TabletDailyRun[]>([])
  const [stats, setStats] = useState<GroupTabletStats | null>(null)
  const [today, setToday] = useState('')
  const [budget, setBudget] = useState<TabletDailyBudget | null>(null)
  const [budgetInitialDraft, setBudgetInitialDraft] = useState('0')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [memberOptions, setMemberOptions] = useState<string[]>([])
  const session = getTenantSession()
  const allowedPrefixes = expandAccessPrefixes(Array.isArray(session?.allowedPrefixes) ? session.allowedPrefixes : [])
  const canSeeTabletBudget = Boolean(session?.isAdmin || allowedPrefixes.includes('/') || allowedPrefixes.includes('/tablette/coffre'))
  const memberSelectOptions = useMemo(() => {
    const current = memberName.trim()
    if (!current) return memberOptions
    return memberOptions.some((name) => name.toLowerCase() === current.toLowerCase()) ? memberOptions : [current, ...memberOptions]
  }, [memberName, memberOptions])

  const totalQty = useMemo(() => Object.values(quantities).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0), [quantities])
  const projectedStockByKey = useMemo(() => (
    items.reduce<Record<string, number>>((acc, item) => {
      const current = Math.max(0, Number(stockByKey[item.key] || 0))
      const added = Math.max(0, Number(quantities[item.key] || 0))
      acc[item.key] = current + added
      return acc
    }, {})
  ), [items, quantities, stockByKey])
  const totalCost = useMemo(
    () =>
      items.reduce((sum, item) => {
        const qty = Math.max(0, Number(quantities[item.key]) || 0)
        return sum + qty * Math.max(0, Number(item.unit_price) || 0)
      }, 0),
    [items, quantities]
  )
  const projectedKitStock = useMemo(() => Math.max(0, Number(projectedStockByKey.kit_cambus || 0)), [projectedStockByKey])
  const projectedDisqueuseStock = useMemo(() => Math.max(0, Number(projectedStockByKey.disqueuse || 0)), [projectedStockByKey])

  const canSubmit = memberName.trim().length > 0 && totalQty > 0 && !saving

  const doneTodayByMember = useMemo(() => {
    const normalized = memberName.trim().toLowerCase()
    if (!normalized) return false
    return runs.some((row) => row.day_key === today && row.member_name.trim().toLowerCase() === normalized)
  }, [memberName, runs, today])
  const tabletteBubbleStats = useMemo(() => {
    return {
      today: stats?.today.runs ?? 0,
      week: stats?.week.runs ?? runs.length,
    }
  }, [stats, runs.length])
  const remainingAfterByRunId = useMemo(() => {
    const map = new Map<string, number>()
    if (!budget) return map

    const todayRunsAsc = runs
      .filter((row) => row.day_key === today)
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    let rolling = Math.max(0, Number(budget.budget_initial || 0))
    for (const row of todayRunsAsc) {
      rolling = Math.max(0, Number((rolling - Math.max(0, Number(row.total_cost || 0))).toFixed(2)))
      map.set(row.id, rolling)
    }
    return map
  }, [budget, runs, today])

  const forceLogout = useCallback(async () => {
    clearTenantSession()
    await clearTenantSessionOnServer().catch(() => undefined)
    window.location.href = '/login'
  }, [])

  const syncTabletSession = useCallback(async () => {
    const res = await fetch('/api/auth/session', withTenantSessionHeader({ cache: 'no-store' }))
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        await forceLogout()
        return false
      }
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error || 'Synchronisation de session impossible.')
    }

    const payload = (await res.json()) as { session?: { groupId: string; groupName: string; groupBadge?: string | null; isAdmin?: boolean; role?: string; roleLabel?: string; allowedPrefixes?: string[] } }
    if (payload.session) {
      saveTenantSession(payload.session, true)
    }
    return true
  }, [forceLogout])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const ok = await syncTabletSession()
      if (!ok) return
      const res = await fetch('/api/tablette/atelier', withTenantSessionHeader({ cache: 'no-store' }))
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          await forceLogout()
          return
        }
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'Impossible de charger la tablette.')
      }
      const data = (await res.json()) as AtelierResponse
      setItems(data.items)
      setStockByKey(data.stock_by_key || {})
      setRuns(data.runs)
      setToday(data.today)
      setStats(data.stats)
      setBudget(data.budget || null)
      setBudgetInitialDraft(String(Math.max(0, Number(data.budget?.budget_initial || 0))))
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
  }, [forceLogout, syncTabletSession])

  useEffect(() => {
    const sessionMember = String(getTenantSession()?.memberName || '').trim()
    if (sessionMember) setMemberName(sessionMember)

    void load()
    void fetch('/api/group/members', withTenantSessionHeader({ cache: 'no-store' }))
      .then(async (res) => {
        if (!res.ok) return []
        const payload = (await res.json()) as { members?: string[] }
        return Array.isArray(payload.members) ? payload.members : []
      })
      .then((rows) => setMemberOptions(rows))
      .catch(() => setMemberOptions([]))
  }, [load])

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
          <div className="mb-3">
            <ActivitiesCategoryTabs active="tablette" tabletteStats={tabletteBubbleStats} />
          </div>
          <PageHeader title="Tablette" subtitle="Quota journalier par membre (00:00 → 00:00). Un membre ne peut valider qu’une fois par jour." />
        </div>

        {stats ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm">Aujourd’hui: <span className="font-semibold">{stats.today.runs} passages</span></div>
            <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-sm">Items aujourd’hui: <span className="font-semibold">{stats.today.items}</span></div>
            <div className="rounded-xl border border-violet-300/25 bg-violet-500/10 p-3 text-sm">Semaine: <span className="font-semibold">{stats.week.runs} passages</span></div>
            <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm">Pas fait aujourd’hui: <span className="font-semibold">{stats.members.filter((m) => !m.did_today).length}</span></div>
          </div>
        ) : null}

        {canSeeTabletBudget ? (
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/[0.08] p-4">
          <h2 className="text-base font-semibold">Coffre tablette du jour</h2>
          <p className="mb-3 text-xs text-white/65">Budget journalier pour payer les passages tablette.</p>
          <div className="grid gap-3 md:grid-cols-1">
            <label className="space-y-1 text-xs text-white/70">
              <span>Budget initial</span>
              <Input value={budgetInitialDraft} onChange={(event) => setBudgetInitialDraft(event.target.value)} inputMode="decimal" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <PrimaryButton
              onClick={async () => {
                const action = budget ? 'update_budget' : 'init_budget'
                const res = await fetch('/api/tablette/atelier', {
                  ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
                  method: 'POST',
                  body: JSON.stringify({
                    action,
                    budget_initial: Math.max(0, Number(budgetInitialDraft || 0)),
                  }),
                })
                if (!res.ok) {
                  const payload = (await res.json().catch(() => null)) as { error?: string } | null
                  setError(payload?.error || 'Impossible de sauvegarder le coffre.')
                  return
                }
                await load()
              }}
            >
              {budget ? 'Modifier coffre' : 'Initialiser coffre'}
            </PrimaryButton>
            <PrimaryButton
              onClick={async () => {
                const res = await fetch('/api/tablette/atelier', {
                  ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
                  method: 'POST',
                  body: JSON.stringify({ action: 'reset_budget' }),
                })
                if (!res.ok) {
                  const payload = (await res.json().catch(() => null)) as { error?: string } | null
                  setError(payload?.error || 'Reset impossible.')
                  return
                }
                await load()
              }}
            >
              Reset jour
            </PrimaryButton>
          </div>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">Date: <span className="font-semibold">{formatDay(today)}</span></div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">Budget: <span className="font-semibold">{Number(budget?.budget_initial || 0).toFixed(2)} $</span></div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">Distribué: <span className="font-semibold">{Number(budget?.distributed_total || 0).toFixed(2)} $</span></div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">Restant: <span className="font-semibold">{Number(budget?.remaining || 0).toFixed(2)} $</span></div>
          </div>
          <p className="mt-2 text-xs text-white/65">Passages payés: <span className="font-semibold text-white">{budget?.paid_runs || 0}</span></p>
        </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-white/60">Nom du membre</label>
              <MemberSelect value={memberName} onChange={setMemberName} options={memberSelectOptions} />
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
                  <div className="mt-2 grid gap-1 text-xs text-white/70">
                    <p>Stock actuel: <span className="font-semibold text-white">{Math.max(0, Number(stockByKey[item.key] || 0))}</span></p>
                    <p>
                      Avec cet ajout: <span className="font-semibold text-emerald-200">+{Math.max(0, Number(quantities[item.key] || 0))}</span>
                      {' '}→ <span className="font-semibold text-white">{Math.max(0, Number(projectedStockByKey[item.key] || 0))}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">Jour: <span className="font-semibold">{formatDay(today)}</span></div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">Quantité totale: <span className="font-semibold">{totalQty}</span></div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">Coût total: <span className="font-semibold">{totalCost.toFixed(2)} $</span></div>
          </div>
          <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70">
            {items.map((item) => {
              const added = Math.max(0, Number(quantities[item.key] || 0))
              if (added <= 0) return null
              const current = Math.max(0, Number(stockByKey[item.key] || 0))
              const next = Math.max(0, Number(projectedStockByKey[item.key] || 0))
              return <p key={`projection-${item.key}`}>{item.name}: {current} + {added} = <span className="font-semibold text-white">{next}</span></p>
            })}
            {totalQty <= 0 ? <p>Aucune projection (aucun item ajouté).</p> : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton
              disabled={!canSubmit || doneTodayByMember}
              onClick={async () => {
                setSaving(true)
                setError(null)
                setSuccess(null)
                try {
                  const ok = await syncTabletSession()
                  if (!ok) return
                  const res = await fetch('/api/tablette/atelier', {
                    ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
                    method: 'POST',
                    body: JSON.stringify({ action: 'run', member_name: memberName, quantities }),
                  })

                  if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                      await forceLogout()
                      return
                    }
                    const payload = (await res.json().catch(() => null)) as { error?: string } | null
                    throw new Error(payload?.error || 'Validation impossible.')
                  }

                  resetForm()
                  setSuccess('Tablette validée, items ajoutés et coffre mis à jour.')
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
          </div>

          {error ? <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
          {success ? <p className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{success}</p> : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-base font-semibold">Récapitulatif</h2>
          <p className="mb-3 text-xs text-white/60">Historique des membres ayant fait la tablette.</p>
          <div className="mb-3 grid gap-2 text-sm md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              Kit après ajout: <span className="font-semibold">{projectedKitStock}</span>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              Disqueuse après ajout: <span className="font-semibold">{projectedDisqueuseStock}</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-white/70">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Membre</th>
                  <th className="px-3 py-2 text-left">Items</th>
                  <th className="px-3 py-2 text-left">Total</th>
                  <th className="px-3 py-2 text-left">Retiré coffre</th>
                  <th className="px-3 py-2 text-left">Restant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-white/60">Chargement…</td></tr>
                ) : runs.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-white/60">Aucun passage tablette.</td></tr>
                ) : (
                  runs.map((row) => {
                    const serverRemaining = row.remaining_after == null ? null : Math.max(0, Number(row.remaining_after || 0))
                    const computedRemaining = remainingAfterByRunId.has(row.id)
                      ? Math.max(0, Number(remainingAfterByRunId.get(row.id) || 0))
                      : null
                    const remainingAfter = serverRemaining ?? computedRemaining
                    return (
                    <tr key={row.id}>
                      <td className="px-3 py-2 text-white/70">{formatDateTime(row.created_at)}</td>
                      <td className="px-3 py-2 font-medium">{row.member_name}</td>
                      <td className="px-3 py-2">{row.total_items}</td>
                      <td className="px-3 py-2">{Number(row.total_cost).toFixed(2)} $</td>
                      <td className="px-3 py-2">{Number(row.total_cost).toFixed(2)} $</td>
                      <td className="px-3 py-2">{remainingAfter == null ? '—' : `${remainingAfter.toFixed(2)} $`}</td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Panel>
  )
}
