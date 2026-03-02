'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { currentGroupId } from '@/lib/tenantScope'
import { StatCard } from '@/components/dashboard/StatCard'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import {
  Box,
  Crosshair,
  Handshake,
  Plus,
  Repeat,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  Leaf,
} from 'lucide-react'

type Tx = {
  id: string
  type: 'purchase' | 'sale'
  total: number | null
  counterparty: string | null
  created_at: string
  transaction_items?: { name_snapshot: string | null; quantity: number | null }[] | null
}

type Loan = {
  id: string
  borrower_name: string
  quantity: number
  loaned_at: string
  weapons: { name: string | null; weapon_id: string | null }[] | null
}

type Expense = {
  id: string
  member_name: string
  item_label: string
  total: number | null
  status: 'pending' | 'paid'
  created_at: string
}

type DrugItem = {
  id: string
  name: string
  stock: number | null
}

const ACTIVITY_ORDER = ['transactions', 'loans', 'expenses', 'plantations'] as const

type ActivityKey = (typeof ACTIVITY_ORDER)[number]

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function sumByKeyword(items: DrugItem[], keyword: string) {
  const k = keyword.toLowerCase()
  return items
    .filter((it) => (it.name || '').toLowerCase().includes(k))
    .reduce((sum, it) => sum + Number(it.stock || 0), 0)
}

export function DashboardClient() {
  const [loading, setLoading] = useState(true)
  const [objectCount, setObjectCount] = useState(0)
  const [weaponCount, setWeaponCount] = useState(0)
  const [activeLoans, setActiveLoans] = useState(0)
  const [txToday, setTxToday] = useState(0)
  const [recentTx, setRecentTx] = useState<Tx[]>([])
  const [recentLoans, setRecentLoans] = useState<Loan[]>([])
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])
  const [drugItems, setDrugItems] = useState<DrugItem[]>([])
  const [activityIndex, setActivityIndex] = useState(0)

  const todayIso = useMemo(() => startOfTodayIso(), [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)

      const [objRes, weapRes, loansRes, txRes, recentTxRes, recentLoansRes, recentExpensesRes, drugItemsRes] = await Promise.all([
        supabase.from('objects').select('id', { count: 'exact', head: true }).eq('group_id', groupId),
        supabase.from('weapons').select('id', { count: 'exact', head: true }).eq('group_id', groupId),
        supabase.from('weapon_loans').select('id', { count: 'exact', head: true }).eq('group_id', groupId).is('returned_at', null),
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('group_id', groupId).gte('created_at', todayIso),
        supabase
          .from('transactions')
          .select('id,type,total,counterparty,created_at,transaction_items(name_snapshot,quantity)')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })
          .limit(7),
        supabase
          .from('weapon_loans')
          .select('id,borrower_name,quantity,loaned_at,weapons(name,weapon_id)')
          .eq('group_id', groupId)
          .is('returned_at', null)
          .order('loaned_at', { ascending: false })
          .limit(7),
        supabase.from('expenses').select('id,member_name,item_label,total,status,created_at').eq('group_id', groupId).order('created_at', { ascending: false }).limit(7),
        supabase.from('drug_items').select('id,name,stock').eq('group_id', groupId),
      ])

      if (!alive) return

      setObjectCount(objRes.count ?? 0)
      setWeaponCount(weapRes.count ?? 0)
      setActiveLoans(loansRes.count ?? 0)
      setTxToday(txRes.count ?? 0)
      setRecentTx((recentTxRes.data as Tx[]) ?? [])
      setRecentLoans((recentLoansRes.data as Loan[]) ?? [])
      setRecentExpenses((recentExpensesRes.data as Expense[]) ?? [])
      setDrugItems((drugItemsRes.data as DrugItem[]) ?? [])

      setLoading(false)
    })()

    return () => {
      alive = false
    }
  }, [todayIso])

  useEffect(() => {
    const t = setInterval(() => {
      setActivityIndex((prev) => (prev + 1) % ACTIVITY_ORDER.length)
    }, 5000)
    return () => clearInterval(t)
  }, [])

  const currentActivity = ACTIVITY_ORDER[activityIndex] as ActivityKey

  const producedCokeLeaves = useMemo(() => sumByKeyword(drugItems, 'Feuille de coke'), [drugItems])
  const producedMethBrut = useMemo(() => sumByKeyword(drugItems, 'Meth brut'), [drugItems])
  const cokeBatches = useMemo(() => {
    const pot = sumByKeyword(drugItems, 'Pot')
    const graines = sumByKeyword(drugItems, 'Graine de coke')
    const engrais = sumByKeyword(drugItems, 'Engrais')
    const eau = sumByKeyword(drugItems, 'Eau')
    return Math.max(0, Math.floor(Math.min(pot / 1, graines / 1, engrais / 1, eau / 3)))
  }, [drugItems])

  const methBatches = useMemo(() => {
    const table = sumByKeyword(drugItems, 'Table')
    const meth = sumByKeyword(drugItems, 'Meth')
    const batterie = sumByKeyword(drugItems, 'Batterie')
    const ammoniaque = sumByKeyword(drugItems, 'Ammoniaque')
    const methylamine = sumByKeyword(drugItems, 'Methylamine')
    return Math.max(0, Math.floor(Math.min(table / 1, meth / 1, batterie / 2, ammoniaque / 16, methylamine / 15)))
  }, [drugItems])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard title="Objets" value={loading ? '—' : String(objectCount)} icon={<Box className="h-5 w-5" />} href="/objets" />
          <StatCard title="Armes" value={loading ? '—' : String(weaponCount)} icon={<Crosshair className="h-5 w-5" />} href="/armes" />
          <StatCard title="Prêts en cours" value={loading ? '—' : String(activeLoans)} icon={<Handshake className="h-5 w-5" />} href="/armes/prets" />
          <StatCard
            title="Transactions aujourd’hui"
            value={loading ? '—' : String(txToday)}
            icon={<Repeat className="h-5 w-5" />}
            href="/objets?tab=transactions"
          />
        </div>

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Dernière activité</h2>
              <p className="mt-1 text-sm text-white/60">Roulement auto : transactions, prêts, dépenses, plantations</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ACTIVITY_ORDER.map((key, idx) => (
                <button
                  key={key}
                  onClick={() => setActivityIndex(idx)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    currentActivity === key ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {key === 'transactions'
                    ? 'Transactions'
                    : key === 'loans'
                    ? 'Prêts'
                    : key === 'expenses'
                    ? 'Dépenses'
                    : 'Plantations'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {currentActivity === 'transactions' ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Transactions récentes</p>
                  <Link href="/objets?tab=transactions" className="text-xs text-white/70 hover:text-white">
                    Ouvrir <ArrowRight className="ml-1 inline h-3 w-3" />
                  </Link>
                </div>

                <div className="mt-3 space-y-2">
                  {recentTx.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">Aucune transaction pour le moment.</div>
                  ) : (
                    recentTx.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            <span
                              className={`mr-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                                t.type === 'purchase'
                                  ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'
                                  : 'border-orange-300/40 bg-orange-500/10 text-orange-100'
                              }`}
                            >
                              {t.type === 'purchase' ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                              {t.type === 'purchase' ? 'Entrée' : 'Sortie'}
                            </span>
                            {t.counterparty ? `• ${t.counterparty}` : ''}
                          </p>
                          <p className="text-xs text-white/60">{new Date(t.created_at).toLocaleString()}</p>
                          <p className="truncate text-xs text-white/50">
                            {t.transaction_items?.length
                              ? t.transaction_items.map((item) => `${item.name_snapshot ?? 'Objet'} ×${item.quantity ?? 0}`).join(', ')
                              : 'Aucun objet renseigné'}
                          </p>
                        </div>
                        <div className="text-sm font-semibold text-white/80">{t.total ?? '—'}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {currentActivity === 'loans' ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Prêts d’armes en cours</p>
                  <Link href="/armes/prets" className="text-xs text-white/70 hover:text-white">
                    Ouvrir <ArrowRight className="ml-1 inline h-3 w-3" />
                  </Link>
                </div>

                <div className="mt-3 space-y-2">
                  {recentLoans.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">Aucun prêt en cours.</div>
                  ) : (
                    recentLoans.map((l) => (
                      <div key={l.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {(() => {
                              const w = l.weapons?.[0]
                              return `${w?.name ?? 'Arme'}${w?.weapon_id ? ` (${w.weapon_id})` : ''} ×${l.quantity}`
                            })()}
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
            ) : null}

            {currentActivity === 'expenses' ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Dépenses récentes</p>
                  <Link href="/depenses" className="text-xs text-white/70 hover:text-white">
                    Ouvrir <ArrowRight className="ml-1 inline h-3 w-3" />
                  </Link>
                </div>

                <div className="mt-3 space-y-2">
                  {recentExpenses.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">Aucune dépense pour le moment.</div>
                  ) : (
                    recentExpenses.map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {e.member_name} • {e.item_label}
                          </p>
                          <p className="text-xs text-white/60">{new Date(e.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                              e.status === 'paid' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'
                            }`}
                          >
                            {e.status === 'paid' ? 'PAYÉ' : 'EN ATTENTE'}
                          </span>
                          <div className="text-sm font-semibold text-white/80">{Number(e.total ?? 0).toFixed(2)} $</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {currentActivity === 'plantations' ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Plantations</p>
                  <Link href="/drogues" className="text-xs text-white/70 hover:text-white">
                    Ouvrir <ArrowRight className="ml-1 inline h-3 w-3" />
                  </Link>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs text-white/60">Production en stock</p>
                    <p className="mt-1 text-sm font-semibold">Feuilles de coke : {producedCokeLeaves}</p>
                    <p className="text-xs text-white/50">Batches possibles : {cokeBatches}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs text-white/60">Production en stock</p>
                    <p className="mt-1 text-sm font-semibold">Meth brut : {producedMethBrut}</p>
                    <p className="text-xs text-white/50">Batches possibles : {methBatches}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/60">
                  <Leaf className="h-3.5 w-3.5" />
                  Données calculées depuis le stock des items drogues.
                </div>
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel>
          <h3 className="text-sm font-semibold">Quick actions</h3>
          <p className="mt-1 text-sm text-white/60">Raccourcis utiles</p>

          <div className="mt-4 space-y-3">
            <Link href="/transactions/nouveau?type=purchase" className="block">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
                    <Plus className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Nouvel achat</p>
                    <p className="text-xs text-white/60">Créer une entrée stock</p>
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
                    <p className="text-xs text-white/60">Suivre les prêts actifs</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-white/50" />
              </div>
            </Link>

            <Link href="/objets" className="block">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
                    <Box className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Catalogue</p>
                    <p className="text-xs text-white/60">Voir tous les objets</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-white/50" />
              </div>
            </Link>

            <Link href="/depenses" className="block">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
                    <Receipt className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Dépenses</p>
                    <p className="text-xs text-white/60">Voir les dépenses</p>
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
