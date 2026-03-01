'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { StatCard } from '@/components/dashboard/StatCard'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Activity, Box, Crosshair, Handshake, Plus, Repeat, ArrowRight } from 'lucide-react'

type Tx = {
  id: string
  type: 'purchase' | 'sale'
  total: number | null
  counterparty: string | null
  created_at: string
}

type Loan = {
  id: string
  borrower_name: string
  quantity: number
  loaned_at: string
  weapons: { name: string | null; weapon_id: string | null }[] | null
}

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function DashboardClient() {
  const [loading, setLoading] = useState(true)
  const [objectCount, setObjectCount] = useState(0)
  const [weaponCount, setWeaponCount] = useState(0)
  const [activeLoans, setActiveLoans] = useState(0)
  const [txToday, setTxToday] = useState(0)
  const [recentTx, setRecentTx] = useState<Tx[]>([])
  const [recentLoans, setRecentLoans] = useState<Loan[]>([])

  const todayIso = useMemo(() => startOfTodayIso(), [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)

      const [objRes, weapRes, loansRes, txRes, recentTxRes, recentLoansRes] = await Promise.all([
        supabase.from('objects').select('id', { count: 'exact', head: true }),
        supabase.from('weapons').select('id', { count: 'exact', head: true }),
        supabase.from('weapon_loans').select('id', { count: 'exact', head: true }).is('returned_at', null),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
        supabase.from('transactions').select('id,type,total,counterparty,created_at').order('created_at', { ascending: false }).limit(7),
        supabase
          .from('weapon_loans')
          .select('id,borrower_name,quantity,loaned_at,weapons(name,weapon_id)')
          .is('returned_at', null)
          .order('loaned_at', { ascending: false })
          .limit(7)
      ])

      if (!alive) return

      setObjectCount(objRes.count ?? 0)
      setWeaponCount(weapRes.count ?? 0)
      setActiveLoans(loansRes.count ?? 0)
      setTxToday(txRes.count ?? 0)
      setRecentTx((recentTxRes.data as Tx[]) ?? [])
      setRecentLoans((recentLoansRes.data as Loan[]) ?? [])

      setLoading(false)
    })()

    return () => {
      alive = false
    }
  }, [todayIso])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard title="Objets" value={loading ? '—' : String(objectCount)} icon={<Box className="h-5 w-5" />} />
          <StatCard title="Armes" value={loading ? '—' : String(weaponCount)} icon={<Crosshair className="h-5 w-5" />} />
          <StatCard title="Prêts en cours" value={loading ? '—' : String(activeLoans)} icon={<Handshake className="h-5 w-5" />} />
          <StatCard title="Transactions aujourd’hui" value={loading ? '—' : String(txToday)} icon={<Repeat className="h-5 w-5" />} />
        </div>

        <Panel>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Dernière activité</h2>
              <p className="mt-1 text-sm text-white/60">Transactions + prêts (mise à jour automatique)</p>
            </div>
            <Link href="/objets">
              <Button variant="secondary">Voir Objets</Button>
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Transactions récentes</p>
                <Link href="/objets?tab=transactions" className="text-xs text-white/70 hover:text-white">
                  Ouvrir <ArrowRight className="ml-1 inline h-3 w-3" />
                </Link>
              </div>

              <div className="mt-3 space-y-2">
                {recentTx.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">
                    Aucune transaction pour le moment.
                  </div>
                ) : (
                  recentTx.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {t.type === 'purchase' ? 'Achat' : 'Sortie'} {t.counterparty ? `• ${t.counterparty}` : ''}
                        </p>
                        <p className="text-xs text-white/60">{new Date(t.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-sm font-semibold text-white/80">{t.total ?? '—'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Prêts d’armes en cours</p>
                <Link href="/armes/prets" className="text-xs text-white/70 hover:text-white">
                  Ouvrir <ArrowRight className="ml-1 inline h-3 w-3" />
                </Link>
              </div>

              <div className="mt-3 space-y-2">
                {recentLoans.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">
                    Aucun prêt en cours.
                  </div>
                ) : (
                  recentLoans.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {(() => { const w = l.weapons?.[0]; return `${w?.name ?? 'Arme'}${w?.weapon_id ? ` (${w.weapon_id})` : ''} ×${l.quantity}` })()}
                        </p>
                        <p className="text-xs text-white/60">
                          Prêté à <span className="font-semibold text-white/80">{l.borrower_name}</span> • {new Date(l.loaned_at).toLocaleString()}
                        </p>
                      </div>
                      <span className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80">EN COURS</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel>
          <h3 className="text-sm font-semibold">Quick actions</h3>
          <p className="mt-1 text-sm text-white/60">Raccourcis utiles</p>

          <div className="mt-4 space-y-3">
            <Link href="/objets/nouveau" className="block">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
                    <Plus className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Ajouter un objet</p>
                    <p className="text-xs text-white/60">Catalogue objets</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-white/50" />
              </div>
            </Link>

            <Link href="/armes/nouveau" className="block">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
                    <Crosshair className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Ajouter une arme</p>
                    <p className="text-xs text-white/60">Catalogue armes</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-white/50" />
              </div>
            </Link>

            <Link href="/objets?tab=transactions" className="block">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
                    <Activity className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Transactions</p>
                    <p className="text-xs text-white/60">Achat / sortie</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-white/50" />
              </div>
            </Link>

            <Link href="/armes/prets" className="block">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
                    <Handshake className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Prêts en cours</p>
                    <p className="text-xs text-white/60">Armes prêtées</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-white/50" />
              </div>
            </Link>
          </div>
        </Panel>

        <Panel className="bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
          <h3 className="text-sm font-semibold">Mode tablette (futur)</h3>
          <p className="mt-1 text-sm text-white/60">
            Une tablette par groupe : affichage du stock + transactions + prêts, avec rôles et accès.
          </p>
        </Panel>
      </div>
    </div>
  )
}