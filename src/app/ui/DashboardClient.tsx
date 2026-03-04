'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { currentGroupId } from '@/lib/tenantScope'
import { StatCard } from '@/components/modules/dashboard/StatCard'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { createSupportTicket } from '@/lib/communicationApi'
import { Box, Handshake, ArrowDownRight, ArrowUpRight, Receipt, ShoppingCart, ChevronRight, FolderOpen, Bug, MessageSquare, LifeBuoy, X, Crosshair, Wrench, Leaf, Wallet } from 'lucide-react'

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

type Expense = { id: string; item_label: string; total: number; quantity: number; created_at: string }
type DrugItem = { id: string; name: string; stock: number; type: string }
type ActivityView = 'transactions' | 'loans' | 'expenses' | 'plantations'

type QuickActionKey = 'purchase' | 'sale' | 'newExpense' | 'loans' | 'catalogue' | 'objects' | 'weapons' | 'expenses' | 'drugs' | 'transactions' | 'newWeapon' | 'newDrug' | 'newEquipment'
type CardKey = 'objects' | 'weapons' | 'loans' | 'transactions' | 'expenses' | 'drugs' | 'catalogue' | 'equipment'

type DashboardMetrics = {
  loading: boolean
  objectCount: number
  weaponCount: number
  activeLoans: number
  txToday: number
  expenseCount: number
  drugCount: number
}

type QuickActionOption = { key: QuickActionKey; title: string; subtitle: string; href: string; icon: LucideIcon }
type CardOption = { key: CardKey; title: string; href: string; icon: LucideIcon; getValue: (metrics: DashboardMetrics) => string }

const QUICK_ACTION_OPTIONS: QuickActionOption[] = [
  { key: 'purchase', title: 'Nouvel achat', subtitle: 'Créer une entrée stock', href: '/transactions/nouveau?type=purchase', icon: ShoppingCart },
  { key: 'sale', title: 'Nouvelle sortie', subtitle: 'Créer une vente/sortie', href: '/transactions/nouveau?type=sale', icon: ArrowUpRight },
  { key: 'newExpense', title: 'Nouvelle dépense', subtitle: 'Ajouter une dépense à rembourser', href: '/finance/depense/nouveau', icon: Wallet },
  { key: 'loans', title: 'Prêts en cours', subtitle: 'Suivre les prêts actifs', href: '/armes/prets', icon: Handshake },
  { key: 'catalogue', title: 'Catalogue', subtitle: 'Voir tous les objets', href: '/objets', icon: FolderOpen },
  { key: 'objects', title: 'Objets', subtitle: 'Catalogue objets', href: '/objets', icon: Box },
  { key: 'weapons', title: 'Armes', subtitle: 'Gestion des armes', href: '/armes', icon: Crosshair },
  { key: 'transactions', title: 'Transactions', subtitle: 'Historique des transactions', href: '/transactions', icon: Receipt },
  { key: 'expenses', title: 'Dépenses', subtitle: 'Suivre les dépenses', href: '/depenses', icon: Receipt },
  { key: 'drugs', title: 'Drogues', subtitle: 'Catalogue drogues', href: '/drogues', icon: Leaf },
  { key: 'newWeapon', title: 'Nouvelle arme', subtitle: 'Créer une entrée arme', href: '/armes/nouveau', icon: Crosshair },
  { key: 'newDrug', title: 'Nouveau produit', subtitle: 'Créer un item drogue', href: '/drogues/nouveau', icon: Leaf },
  { key: 'newEquipment', title: 'Nouvel équipement', subtitle: 'Créer un équipement', href: '/equipement/nouveau', icon: Wrench },
]
const CARD_OPTIONS: CardOption[] = [
  { key: 'objects', title: 'Objets', href: '/objets', icon: Box, getValue: (v) => (v.loading ? '—' : String(v.objectCount)) },
  { key: 'weapons', title: 'Armes', href: '/armes', icon: Crosshair, getValue: (v) => (v.loading ? '—' : String(v.weaponCount)) },
  { key: 'loans', title: 'Prêts en cours', href: '/armes/prets', icon: Handshake, getValue: (v) => (v.loading ? '—' : String(v.activeLoans)) },
  { key: 'transactions', title: 'Transactions', href: '/transactions', icon: Receipt, getValue: (v) => (v.loading ? '—' : String(v.txToday)) },
  { key: 'expenses', title: 'Dépenses', href: '/depenses', icon: Receipt, getValue: (v) => (v.loading ? '—' : String(v.expenseCount)) },
  { key: 'drugs', title: 'Drogues', href: '/drogues', icon: Leaf, getValue: (v) => (v.loading ? '—' : String(v.drugCount)) },
  { key: 'catalogue', title: 'Catalogue', href: '/objets', icon: FolderOpen, getValue: (v) => (v.loading ? '—' : String(v.objectCount + v.weaponCount + v.drugCount)) },
  { key: 'equipment', title: 'Équipement', href: '/equipement', icon: Wrench, getValue: () => '→' },
]

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
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])
  const [drugItems, setDrugItems] = useState<DrugItem[]>([])
  const [activityView, setActivityView] = useState<ActivityView>('transactions')
  const [pauseAutoUntil, setPauseAutoUntil] = useState(0)
  const [ticketKind, setTicketKind] = useState<'bug' | 'message'>('bug')
  const [ticketMessage, setTicketMessage] = useState('')
  const [ticketImage, setTicketImage] = useState<File | null>(null)
  const [ticketStatus, setTicketStatus] = useState('')
  const [supportOpen, setSupportOpen] = useState(false)
  const supportPanelRef = useRef<HTMLDivElement | null>(null)
  const pressTimerRef = useRef<number | null>(null)
  const [quickActions, setQuickActions] = useState<QuickActionKey[]>(['purchase', 'sale', 'newExpense', 'loans', 'catalogue'])
  const [dashboardCards, setDashboardCards] = useState<CardKey[]>(['objects', 'weapons', 'loans', 'transactions'])
  const [quickModalOpen, setQuickModalOpen] = useState(false)
  const [quickRemoveMode, setQuickRemoveMode] = useState(false)
  const [cardPickerSlot, setCardPickerSlot] = useState<number | null>(null)
  const ticketPreviewUrl = useMemo(() => (ticketImage ? URL.createObjectURL(ticketImage) : null), [ticketImage])

  useEffect(() => {
    return () => {
      if (ticketPreviewUrl) URL.revokeObjectURL(ticketPreviewUrl)
    }
  }, [ticketPreviewUrl])

  useEffect(() => {
    if (!supportOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSupportOpen(false)
    }

    const onMouseDown = (event: MouseEvent) => {
      if (!supportPanelRef.current) return
      if (supportPanelRef.current.contains(event.target as Node)) return
      setSupportOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onMouseDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onMouseDown)
    }
  }, [supportOpen])


  useEffect(() => {
    ;(async () => {
      const [quickRes, cardsRes] = await Promise.all([
        fetch('/api/ui-layouts?page_key=dashboard.quick_actions', { cache: 'no-store' }),
        fetch('/api/ui-layouts?page_key=dashboard.cards', { cache: 'no-store' }),
      ])
      if (quickRes.ok) {
        const data = await quickRes.json()
        if (Array.isArray(data.order) && data.order.length) {
          const next = data.order.filter((key: unknown): key is QuickActionKey => QUICK_ACTION_OPTIONS.some((option) => option.key === key))
          if (next.length) setQuickActions(next)
        }
      }
      if (cardsRes.ok) {
        const data = await cardsRes.json()
        if (Array.isArray(data.order) && data.order.length) {
          const next = data.order.filter((key: unknown): key is CardKey => CARD_OPTIONS.some((option) => option.key === key))
          if (next.length) setDashboardCards(next)
        }
      }
    })()
  }, [])

  async function persistLayouts(nextQuick = quickActions, nextCards = dashboardCards) {
    await fetch('/api/ui-layouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_key: 'dashboard.quick_actions', order: nextQuick, scope_type: 'group' }),
    })
    await fetch('/api/ui-layouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_key: 'dashboard.cards', order: nextCards, scope_type: 'group' }),
    })
  }

  const todayIso = useMemo(() => startOfTodayIso(), [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const groupId = currentGroupId()
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
            .limit(5),
          supabase
            .from('weapon_loans')
            .select('id,borrower_name,quantity,loaned_at,weapons(name,weapon_id)')
            .eq('group_id', groupId)
            .is('returned_at', null)
            .order('loaned_at', { ascending: false })
            .limit(5),
          supabase
            .from('expenses')
            .select('id,item_label,total,quantity,created_at')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('drug_items')
            .select('id,name,stock,type')
            .eq('group_id', groupId)
            .order('stock', { ascending: false })
            .limit(8),
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
      } finally {
        if (alive) setLoading(false)
      }
    })().catch(() => {
      if (alive) setLoading(false)
    })

    return () => {
      alive = false
    }
  }, [todayIso])

  useEffect(() => {
    const views: ActivityView[] = ['transactions', 'loans', 'expenses', 'plantations']
    const timer = window.setInterval(() => {
      if (Date.now() < pauseAutoUntil) return
      setActivityView((prev) => {
        const idx = views.indexOf(prev)
        return views[(idx + 1) % views.length]
      })
    }, 5000)
    return () => window.clearInterval(timer)
  }, [pauseAutoUntil])

  async function submitTicket() {
    if (!ticketMessage.trim()) {
      setTicketStatus('Message requis.')
      return
    }
    try {
      await createSupportTicket({ kind: ticketKind, message: ticketMessage.trim(), imageFile: ticketImage })
      setTicketMessage('')
      setTicketImage(null)
      setTicketStatus(ticketKind === 'bug' ? 'Bug envoyé.' : 'Message envoyé.')
    } catch (e: any) {
      setTicketStatus(e?.message || 'Envoi impossible')
    }
  }

  function selectActivity(view: ActivityView) {
    setActivityView(view)
    setPauseAutoUntil(Date.now() + 12000)
  }


  function addQuickAction(actionKey: QuickActionKey) {
    const selected = QUICK_ACTION_OPTIONS.find((a) => a.key === actionKey)
    if (!selected || quickActions.includes(actionKey)) return
    const next = [...quickActions, selected.key]
    setQuickActions(next)
    setQuickModalOpen(false)
    void persistLayouts(next, dashboardCards)
  }

  function removeQuickAction(actionKey: QuickActionKey) {
    const next = quickActions.filter((key) => key !== actionKey)
    setQuickActions(next)
    void persistLayouts(next, dashboardCards)
  }

  function onCardPressStart(cardKey: CardKey) {
    const slot = dashboardCards.findIndex((k) => k === cardKey)
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
    pressTimerRef.current = window.setTimeout(() => setCardPickerSlot(slot >= 0 ? slot : 0), 550)
  }
  function onCardPressEnd() {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  function applyCardChoice(nextCard: CardKey) {
    if (cardPickerSlot === null) return
    const next = dashboardCards.map((value, index) => (index === cardPickerSlot ? nextCard : value))
    setDashboardCards(next)
    setCardPickerSlot(null)
    void persistLayouts(quickActions, next)
  }

  function onSupportPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.items)
      .filter((i) => i.type.startsWith('image/'))
      .map((i) => i.getAsFile())
      .filter((f): f is File => !!f)
    if (!files.length) return
    e.preventDefault()
    setTicketImage(files[0])
    setTicketStatus('Image collée depuis le presse-papier.')
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {dashboardCards.map((cardKey, idx) => {
            const card = CARD_OPTIONS.find((c) => c.key === cardKey) || CARD_OPTIONS[idx] || CARD_OPTIONS[0]
            const Icon = card.icon
            return (
              <div key={`${card.key}-${idx}`} onMouseDown={() => onCardPressStart(card.key)} onMouseUp={onCardPressEnd} onMouseLeave={onCardPressEnd} onContextMenu={(e) => { e.preventDefault(); onCardPressStart(card.key) }}>
              <StatCard title={card.title} value={card.getValue({ loading, objectCount, weaponCount, activeLoans, txToday, expenseCount: recentExpenses.length, drugCount: drugItems.length })} icon={<Icon className="h-5 w-5" />} href={card.href} />
              </div>
            )
          })}
        </div>

        <Panel>
          <h3 className="text-sm font-semibold">Dernière activité</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ['transactions', 'Transactions'],
              ['loans', 'Prêts'],
              ['expenses', 'Dépenses'],
              ['plantations', 'Plantations'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => selectActivity(key as ActivityView)}
                className={`rounded-lg border px-2.5 py-1 text-xs ${activityView === key ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-white/70'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {activityView === 'transactions' && recentTx.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">Aucune transaction pour le moment.</div>
            ) : null}
            {activityView === 'transactions' ? (
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
                  </div>
                  <div className="text-sm font-semibold text-white/80">{t.total ?? '—'}</div>
                </div>
              ))
            ) : null}
            {activityView === 'loans' ? (
              recentLoans.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">Aucun prêt actif.</div>
              ) : (
                recentLoans.map((l) => (
                  <div key={l.id} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                    <p className="text-sm font-medium">{l.borrower_name} • x{l.quantity}</p>
                    <p className="text-xs text-white/60">{new Date(l.loaned_at).toLocaleString()}</p>
                  </div>
                ))
              )
            ) : null}
            {activityView === 'expenses' ? (
              recentExpenses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">Aucune dépense récente.</div>
              ) : (
                recentExpenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{e.item_label} • x{e.quantity}</p>
                      <p className="text-xs text-white/60">{new Date(e.created_at).toLocaleString()}</p>
                    </div>
                    <p className="text-sm font-semibold text-white/80">{e.total}$</p>
                  </div>
                ))
              )
            ) : null}
            {activityView === 'plantations' ? (
              drugItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">Aucune donnée plantation.</div>
              ) : (
                drugItems.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-white/70">Stock: {d.stock}</p>
                  </div>
                ))
              )
            ) : null}
          </div>
        </Panel>

      </div>

      <div className="flex h-full flex-col gap-4">
        <Panel>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Quick actions</h3>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setQuickModalOpen(true)} className="rounded-md border border-white/10 bg-white/5 px-2 text-xs">+</button>
              <button type="button" onClick={() => setQuickRemoveMode((v) => !v)} className={`rounded-md border px-2 text-xs ${quickRemoveMode ? 'border-rose-300/40 bg-rose-500/20' : 'border-white/10 bg-white/5'}`}>−</button>
            </div>
          </div>
          <p className="mt-1 text-sm text-white/60">Raccourcis utiles</p>
          <div className="mt-3 space-y-2">
            {quickActions.map((actionKey, idx) => {
              const action = QUICK_ACTION_OPTIONS.find((a) => a.key === actionKey) || QUICK_ACTION_OPTIONS[idx]
              if (!action) return null
              const Icon = action.icon
              return (
                <Link key={`${action.key}-${idx}`} href={action.href} className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:bg-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10"><Icon className="h-4 w-4" /></span>
                    <div>
                      <p className="text-sm font-medium">{action.title}</p>
                      <p className="text-xs text-white/60">{action.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {quickRemoveMode ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          removeQuickAction(action.key)
                        }}
                        className="rounded-md border border-rose-300/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-100"
                      >
                        Retirer
                      </button>
                    ) : null}
                    <ChevronRight className="h-4 w-4 text-white/60" />
                  </div>
                </Link>
              )
            })}
          </div>
        </Panel>

      </div>
    </div>
      {quickModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/20 bg-slate-950/95 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Ajouter un raccourci</h3>
              <button type="button" onClick={() => setQuickModalOpen(false)} className="rounded-md border border-white/10 bg-white/5 p-1"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK_ACTION_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const disabled = quickActions.includes(opt.key)
                return (
                  <button key={opt.key} type="button" disabled={disabled} onClick={() => addQuickAction(opt.key)} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left disabled:opacity-40">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Icon className="h-4 w-4" /></span>
                    <div>
                      <p className="text-sm font-medium">{opt.title}</p>
                      <p className="text-xs text-white/60">{disabled ? 'Déjà ajouté' : opt.subtitle}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {cardPickerSlot !== null ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-slate-950/95 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Choisir la carte</h3>
              <button type="button" onClick={() => setCardPickerSlot(null)} className="rounded-md border border-white/10 bg-white/5 p-1"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {CARD_OPTIONS.map((opt) => (
                <button key={opt.key} type="button" onClick={() => applyCardChoice(opt.key)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10">
                  {opt.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setSupportOpen((value) => !value)}
        className="fixed bottom-3 left-3 z-40 inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/70 px-2 py-1 text-[10px] text-white/80 hover:bg-black/90"
      >
        <LifeBuoy className="h-3 w-3" />
        Support
      </button>

      {supportOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40">
          <div
            ref={supportPanelRef}
            className="absolute bottom-14 left-3 w-[min(92vw,380px)] rounded-2xl border border-white/20 bg-slate-950/95 p-3 shadow-2xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Support</h3>
              <button type="button" onClick={() => setSupportOpen(false)} className="rounded-md border border-white/10 bg-white/5 p-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <button type="button" onClick={() => setTicketKind('bug')} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${ticketKind === 'bug' ? 'border-rose-300/50 bg-rose-500/10 text-rose-100' : 'border-white/10 bg-white/5'}`}><Bug className="h-3 w-3" />Signaler un bug</button>
                <button type="button" onClick={() => setTicketKind('message')} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${ticketKind === 'message' ? 'border-cyan-300/50 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/5'}`}><MessageSquare className="h-3 w-3" />Message</button>
              </div>
              <textarea
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                onPaste={onSupportPaste}
                placeholder={ticketKind === 'bug' ? 'Décris le bug... (Ctrl+V image accepté)' : 'Ton message... (Ctrl+V image accepté)'}
                className="h-20 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
              <input type="file" accept="image/*" onChange={(e) => setTicketImage(e.target.files?.[0] ?? null)} className="w-full text-xs text-white/70" />
              {ticketImage ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ticketPreviewUrl || ''} alt="Preview support" className="max-h-28 rounded-md object-contain" />
                </div>
              ) : null}
              <Button onClick={submitTicket}>{ticketKind === 'bug' ? 'Envoyer le bug' : 'Envoyer le message'}</Button>
              {ticketStatus ? <p className="text-xs text-white/70">{ticketStatus}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
