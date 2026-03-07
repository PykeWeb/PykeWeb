'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { currentGroupId } from '@/lib/tenantScope'
import { StatCard } from '@/components/modules/dashboard/StatCard'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { createSupportTicket } from '@/lib/communicationApi'
import { listFinanceEntries, type FinanceCategory, type FinanceMovementType } from '@/lib/financeApi'
import { getFinanceListImage } from '@/lib/financeVisuals'
import { Box, ArrowDownRight, ArrowUpRight, Receipt, ShoppingCart, ChevronRight, FolderOpen, Bug, MessageSquare, LifeBuoy, Info, X, Wallet, PlusCircle, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react'

type Tx = {
  id: string
  source: string
  entry_id: string
  type: 'purchase' | 'sale'
  total: number | null
  counterparty: string | null
  created_at: string
  item_image_url: string | null
  transaction_items?: { name_snapshot: string | null; quantity: number | null }[] | null
}

type Expense = { id: string; item_label: string; total: number; quantity: number; created_at: string; item_image_url: string | null }
type ActivityView = 'summary' | 'transactions' | 'expenses' | 'finance'

type QuickActionKey = 'newExpense' | 'itemCreate' | 'itemTrade' | 'finance' | 'items'
type CardKey = 'catObjects' | 'catWeapons' | 'catEquipment' | 'catDrugs' | 'catOther' | 'mvExpense' | 'mvPurchase' | 'mvSale' | 'calculator'

type DashboardMetrics = {
  loading: boolean
  categoryCounts: Record<FinanceCategory, number>
  movementCounts: Record<FinanceMovementType, number>
}

type QuickActionOption = { key: QuickActionKey; title: string; subtitle: string; href: string; icon: LucideIcon }
type CardOption = { key: CardKey; title: string; href: string; icon: LucideIcon; getValue: (metrics: DashboardMetrics) => string }

const QUICK_ACTION_OPTIONS: QuickActionOption[] = [
  { key: 'newExpense', title: 'Nouvelle dépense', subtitle: 'Créer une dépense Finance', href: '/finance/depense/nouveau', icon: Wallet },
  { key: 'itemCreate', title: 'Créer un item', subtitle: 'Nouveau dans le catalogue', href: '/items/nouveau', icon: PlusCircle },
  { key: 'itemTrade', title: 'Achat/Vente items', subtitle: 'Achat et sortie de stock', href: '/items/achat-vente', icon: Receipt },
  { key: 'finance', title: 'Espace Finance', subtitle: 'Voir toutes les opérations', href: '/finance', icon: Wallet },
  { key: 'items', title: 'Espace Items', subtitle: 'Voir le catalogue items', href: '/items', icon: Box },
]
const CARD_OPTIONS: CardOption[] = [
  { key: 'catObjects', title: 'Objets', href: '/items?category=objects', icon: Box, getValue: (v) => (v.loading ? '—' : String(v.categoryCounts.objects)) },
  { key: 'catWeapons', title: 'Armes', href: '/items?category=weapons', icon: Box, getValue: (v) => (v.loading ? '—' : String(v.categoryCounts.weapons)) },
  { key: 'catEquipment', title: 'Équipement', href: '/items?category=equipment', icon: Box, getValue: (v) => (v.loading ? '—' : String(v.categoryCounts.equipment)) },
  { key: 'catDrugs', title: 'Drogues', href: '/items?category=drugs', icon: Box, getValue: (v) => (v.loading ? '—' : String(v.categoryCounts.drugs)) },
  { key: 'catOther', title: 'Autres', href: '/items?category=custom', icon: FolderOpen, getValue: (v) => (v.loading ? '—' : String(v.categoryCounts.other + v.categoryCounts.custom)) },
  { key: 'mvExpense', title: 'Dépenses', href: '/finance?type=expense', icon: Wallet, getValue: (v) => (v.loading ? '—' : String(v.movementCounts.expense)) },
  { key: 'mvPurchase', title: 'Achats', href: '/finance?type=purchase', icon: ShoppingCart, getValue: (v) => (v.loading ? '—' : String(v.movementCounts.purchase)) },
  { key: 'mvSale', title: 'Ventes', href: '/finance?type=sale', icon: ArrowUpRight, getValue: (v) => (v.loading ? '—' : String(v.movementCounts.sale)) },
  { key: 'calculator', title: 'Calculateur', href: '/items?view=tools', icon: Receipt, getValue: () => '→' },
]

const DEFAULT_DASHBOARD_CARDS: CardKey[] = ['catObjects', 'catWeapons', 'catEquipment', 'catDrugs']

function mergeCardOrder(order: CardKey[] | null | undefined): CardKey[] {
  const allowed = new Set(CARD_OPTIONS.map((option) => option.key))
  const safeOrder = (order ?? [])
    .filter((key, index, list) => allowed.has(key) && list.indexOf(key) === index)
    .slice(0, DEFAULT_DASHBOARD_CARDS.length)
  const missing = DEFAULT_DASHBOARD_CARDS.filter((key) => !safeOrder.includes(key))
  return [...safeOrder, ...missing].slice(0, DEFAULT_DASHBOARD_CARDS.length)
}

export function DashboardClient() {
  const [loading, setLoading] = useState(true)
  const [recentTx, setRecentTx] = useState<Tx[]>([])
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])

  const [financeCategoryCounts, setFinanceCategoryCounts] = useState<Record<FinanceCategory, number>>({
    objects: 0,
    weapons: 0,
    equipment: 0,
    drugs: 0,
    custom: 0,
    other: 0,
  })
  const [financeMovementCounts, setFinanceMovementCounts] = useState<Record<FinanceMovementType, number>>({
    expense: 0,
    purchase: 0,
    sale: 0,
  })
  const [activityView, setActivityView] = useState<ActivityView>('summary')
  const [pauseAutoUntil, setPauseAutoUntil] = useState(0)
  const [ticketKind, setTicketKind] = useState<'bug' | 'message'>('bug')
  const [ticketMessage, setTicketMessage] = useState('')
  const [ticketImage, setTicketImage] = useState<File | null>(null)
  const [ticketStatus, setTicketStatus] = useState('')
  const [supportOpen, setSupportOpen] = useState(false)
  const supportPanelRef = useRef<HTMLDivElement | null>(null)
  const cardLongPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)
  const [quickActions, setQuickActions] = useState<QuickActionKey[]>(['newExpense', 'itemCreate', 'itemTrade', 'finance', 'items'])
  const [dashboardCards, setDashboardCards] = useState<CardKey[]>(DEFAULT_DASHBOARD_CARDS)
  const [quickModalOpen, setQuickModalOpen] = useState(false)
  const [quickRemoveMode, setQuickRemoveMode] = useState(false)
  const [uiLayoutsReady, setUiLayoutsReady] = useState(false)
  const [cardManagerOpen, setCardManagerOpen] = useState(false)
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
    let alive = true
    ;(async () => {
      try {
        const [quickRes, cardsRes] = await Promise.all([
          fetch('/api/ui-layouts?page_key=dashboard.quick_actions', { cache: 'no-store' }),
          fetch('/api/ui-layouts?page_key=dashboard.cards', { cache: 'no-store' }),
        ])
        if (quickRes.ok) {
          const data = await quickRes.json()
          if (Array.isArray(data.order) && data.order.length) {
            const next = data.order.filter((key: unknown): key is QuickActionKey => QUICK_ACTION_OPTIONS.some((option) => option.key === key))
            if (next.length && alive) setQuickActions(next)
          }
        }
        if (cardsRes.ok) {
          const data = await cardsRes.json()
          if (Array.isArray(data.order) && data.order.length) {
            const next = data.order.filter((key: unknown): key is CardKey => CARD_OPTIONS.some((option) => option.key === key))
            if (alive) setDashboardCards(mergeCardOrder(next))
          }
        }
      } finally {
        if (alive) setUiLayoutsReady(true)
      }
    })()
    return () => {
      alive = false
    }
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

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        currentGroupId()
        const financeEntries = await listFinanceEntries()

        if (!alive) return

        const categoryCounts: Record<FinanceCategory, number> = { objects: 0, weapons: 0, equipment: 0, drugs: 0, custom: 0, other: 0 }
        const movementCounts: Record<FinanceMovementType, number> = { expense: 0, purchase: 0, sale: 0 }
        for (const entry of financeEntries) {
          categoryCounts[entry.category] += 1
          movementCounts[entry.movement_type] += 1
        }

        const recentFinanceTransactions: Tx[] = financeEntries
          .filter((entry) => entry.movement_type === 'purchase' || entry.movement_type === 'sale')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 8)
          .map((entry) => ({
            id: `${entry.source}-${entry.id}`,
            source: entry.source,
            entry_id: entry.id,
            type: entry.movement_type === 'purchase' ? 'purchase' : 'sale',
            total: entry.amount ?? null,
            counterparty: entry.member_name || null,
            created_at: entry.created_at,
            item_image_url: getFinanceListImage({ movementType: entry.movement_type, isMulti: entry.is_multi, itemImageUrl: entry.item_image_url }),
            transaction_items: [{ name_snapshot: entry.item_label, quantity: entry.quantity }],
          }))

        const recentExpenseRows: Expense[] = financeEntries
          .filter((entry) => entry.movement_type === 'expense')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
          .map((entry) => ({
            id: entry.id,
            item_label: entry.item_label,
            total: Number(entry.amount ?? 0) || 0,
            quantity: Math.max(1, Number(entry.quantity ?? 1) || 1),
            created_at: entry.created_at,
            item_image_url: getFinanceListImage({
              movementType: entry.movement_type,
              category: entry.category,
              isMulti: entry.is_multi,
              itemImageUrl: entry.item_image_url,
            }),
          }))

        setRecentTx(recentFinanceTransactions)
        setRecentExpenses(recentExpenseRows)
        setFinanceCategoryCounts(categoryCounts)
        setFinanceMovementCounts(movementCounts)
      } finally {
        if (alive) setLoading(false)
      }
    })().catch(() => {
      if (alive) setLoading(false)
    })

    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const views: ActivityView[] = ['summary', 'transactions', 'expenses', 'finance']
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
    } catch (e: unknown) {
      setTicketStatus(e instanceof Error ? e.message : 'Envoi impossible')
    }
  }

  function selectActivity(view: ActivityView) {
    setActivityView(view)
    setPauseAutoUntil(Date.now() + 12000)
  }

  const financeActivitySummary = useMemo(() => {
    const totalOps = financeMovementCounts.expense + financeMovementCounts.purchase + financeMovementCounts.sale
    const totalAmountTx = recentTx.reduce((sum, tx) => sum + (Number(tx.total ?? 0) || 0), 0)
    const totalAmountExpenses = recentExpenses.reduce((sum, expense) => sum + (Number(expense.total ?? 0) || 0), 0)
    return {
      totalOps,
      totalAmountTx,
      totalAmountExpenses,
    }
  }, [financeMovementCounts, recentExpenses, recentTx])


  const mergedFinanceActivity = useMemo(() => {
    const txRows = recentTx.map((tx) => ({
      id: `tx-${tx.id}`,
      label: tx.type === 'purchase' ? 'Transaction achat' : 'Transaction vente',
      detail: tx.counterparty || 'Interlocuteur non renseigné',
      amount: tx.total,
      href: `/finance/transactions/${tx.source}/${encodeURIComponent(tx.entry_id)}`,
      createdAt: tx.created_at,
      imageUrl: tx.item_image_url,
    }))

    const expenseRows = recentExpenses.map((expense) => ({
      id: `expense-${expense.id}`,
      label: 'Dépense',
      detail: expense.item_label,
      amount: expense.total,
      href: '/finance?type=expense',
      createdAt: expense.created_at,
      imageUrl: expense.item_image_url,
    }))

    return [...txRows, ...expenseRows]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
  }, [recentExpenses, recentTx])


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




  function onCardPointerDown() {
    longPressTriggeredRef.current = false
    if (cardLongPressTimerRef.current) window.clearTimeout(cardLongPressTimerRef.current)
    cardLongPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true
      setCardManagerOpen(true)
    }, 600)
  }

  function onCardPointerEnd() {
    if (!cardLongPressTimerRef.current) return
    window.clearTimeout(cardLongPressTimerRef.current)
    cardLongPressTimerRef.current = null
  }

  function onCardClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!longPressTriggeredRef.current) return
    event.preventDefault()
    event.stopPropagation()
    longPressTriggeredRef.current = false
  }


  function applyCardChoice(nextCard: CardKey) {
    if (cardPickerSlot === null) return
    const next = dashboardCards.map((card, index) => (index === cardPickerSlot ? nextCard : card))
    const unique = next.filter((card, index, list) => list.indexOf(card) === index)
    const missing = DEFAULT_DASHBOARD_CARDS.filter((card) => !unique.includes(card))
    const finalOrder = [...unique, ...missing].slice(0, DEFAULT_DASHBOARD_CARDS.length)
    setDashboardCards(finalOrder)
    setCardPickerSlot(null)
    void persistLayouts(quickActions, finalOrder)
  }

  function moveDashboardCard(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= dashboardCards.length) return
    const next = [...dashboardCards]
    const [entry] = next.splice(index, 1)
    next.splice(targetIndex, 0, entry)
    setDashboardCards(next)
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
          {!uiLayoutsReady ? Array.from({ length: 4 }).map((_, idx) => (
            <div key={`card-skeleton-${idx}`} className="h-[118px] rounded-2xl border border-white/10 bg-white/[0.03] animate-pulse" />
          )) : null}
          {uiLayoutsReady ? dashboardCards.map((cardKey, idx) => {
            const card = CARD_OPTIONS.find((c) => c.key === cardKey) || CARD_OPTIONS[idx] || CARD_OPTIONS[0]
            const Icon = card.icon
            return (
              <div key={`${card.key}-${idx}`} className="select-none touch-none" onPointerDown={onCardPointerDown} onPointerUp={onCardPointerEnd} onPointerLeave={onCardPointerEnd} onPointerCancel={onCardPointerEnd} onClickCapture={onCardClickCapture}>
              <StatCard title={card.title} value={card.getValue({ loading, categoryCounts: financeCategoryCounts, movementCounts: financeMovementCounts })} icon={<Icon className="h-5 w-5" />} href={card.href} />
              </div>
            )
          }) : null}
        </div>

        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Dernière activité</h3>
            <Link href="/finance" className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs text-white/90 hover:bg-white/[0.12]">
              Ouvrir Finance
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ['summary', 'Résumé'],
              ['transactions', 'Transactions'],
              ['expenses', 'Dépenses'],
              ['finance', 'Flux Finance'],
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
            {activityView === 'summary' ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-xs text-white/60">Opérations Finance</p>
                  <p className="text-sm font-semibold">{financeActivitySummary.totalOps} au total</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-xs text-white/60">Répartition</p>
                  <p className="text-sm font-semibold">{financeMovementCounts.purchase} achats · {financeMovementCounts.sale} ventes · {financeMovementCounts.expense} dépenses</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-xs text-white/60">Montant transactions récentes</p>
                  <p className="text-sm font-semibold">{financeActivitySummary.totalAmountTx.toFixed(2)} $</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-xs text-white/60">Montant dépenses récentes</p>
                  <p className="text-sm font-semibold">{financeActivitySummary.totalAmountExpenses.toFixed(2)} $</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-xs text-white/60">Dernière transaction</p>
                  <p className="truncate text-sm font-semibold">{recentTx[0]?.counterparty || '—'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-xs text-white/60">Dernière dépense</p>
                  <p className="truncate text-sm font-semibold">{recentExpenses[0]?.item_label || '—'}</p>
                </div>
              </div>
            ) : null}
            {activityView === 'transactions' && recentTx.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">Aucune transaction pour le moment.</div>
            ) : null}
            {activityView === 'transactions' ? (
              recentTx.map((t) => (
                <Link href={`/finance/transactions/${t.source}/${encodeURIComponent(t.entry_id)}`} key={t.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 transition hover:bg-white/[0.06]">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                      {t.item_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.item_image_url} alt={t.counterparty || 'Transaction'} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-4 w-4" /></div>
                      )}
                    </div>
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
                      {t.counterparty ? `• ${t.counterparty}` : '• Interlocuteur non renseigné'}
                    </p>
                    <p className="text-xs text-white/60">{new Date(t.created_at).toLocaleString()}</p>
                    <p className="truncate text-xs text-white/50">{t.transaction_items?.map((item) => `${item.name_snapshot || 'Item'} x${Math.max(1, Number(item.quantity) || 1)}`).join(' · ') || 'Aucun item lié'}</p>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-white/80">{t.total ?? '—'}</div>
                </Link>
              ))
            ) : null}
            {activityView === 'expenses' ? (
              recentExpenses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">Aucune dépense récente.</div>
              ) : (
                recentExpenses.map((e) => (
                  <Link href="/finance?type=expense" key={e.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 transition hover:bg-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                        {e.item_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.item_image_url} alt={e.item_label} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-4 w-4" /></div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{e.item_label} • x{e.quantity}</p>
                        <p className="text-xs text-white/60">{new Date(e.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-white/80">{e.total}$</p>
                  </Link>
                ))
              )
            ) : null}
            {activityView === 'finance' ? (
              mergedFinanceActivity.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">Aucune activité Finance récente.</div>
              ) : (
                mergedFinanceActivity.map((entry) => (
                  <Link href={entry.href} key={entry.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 transition hover:bg-white/[0.06]">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                        {entry.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entry.imageUrl} alt={entry.label} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-4 w-4" /></div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{entry.label} • {entry.detail}</p>
                        <p className="text-xs text-white/60">{new Date(entry.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-white/80">{entry.amount ?? '—'}{entry.amount != null ? '$' : ''}</p>
                  </Link>
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
            {!uiLayoutsReady ? Array.from({ length: 3 }).map((_, idx) => (
              <div key={`quick-skeleton-${idx}`} className="h-[62px] rounded-xl border border-white/10 bg-white/[0.03] animate-pulse" />
            )) : null}
            {uiLayoutsReady ? quickActions.map((actionKey, idx) => {
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
            }) : null}
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


      {cardManagerOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setCardManagerOpen(false)}>
          <div className="w-full max-w-3xl rounded-2xl border border-white/20 bg-slate-950/95 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Bulles Dashboard</h3>
              <button type="button" onClick={() => setCardManagerOpen(false)} className="rounded-md border border-white/10 bg-white/5 p-1"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-2">
              {dashboardCards.map((cardKey, index) => {
                const card = CARD_OPTIONS.find((option) => option.key === cardKey)
                if (!card) return null
                const Icon = card.icon
                return (
                  <div key={`${card.key}-${index}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/10"><Icon className="h-4 w-4" /></span>
                      <div>
                        <p className="text-sm font-medium">{card.title}</p>
                        <p className="text-xs text-white/60">{card.href}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveDashboardCard(index, 'up')} disabled={index === 0} className="rounded-md border border-white/10 bg-white/5 p-1 disabled:opacity-40"><ChevronUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => moveDashboardCard(index, 'down')} disabled={index === dashboardCards.length - 1} className="rounded-md border border-white/10 bg-white/5 p-1 disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setCardPickerSlot(index)} className="rounded-md border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100">Remplacer</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {cardPickerSlot !== null ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setCardPickerSlot(null)}>
          <div className="w-full max-w-3xl rounded-2xl border border-white/20 bg-slate-950/95 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Choisir une bulle</h3>
              <button type="button" onClick={() => setCardPickerSlot(null)} className="rounded-md border border-white/10 bg-white/5 p-1"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {CARD_OPTIONS.map((option) => {
                const Icon = option.icon
                const disabled = dashboardCards.includes(option.key)
                return (
                  <button key={option.key} type="button" disabled={disabled} onClick={() => applyCardChoice(option.key)} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10 disabled:opacity-40">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/10"><Icon className="h-4 w-4" /></span>
                    <div>
                      <p className="text-sm font-medium">{option.title}</p>
                      <p className="text-xs text-white/60">{disabled ? 'Déjà utilisée' : option.href}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
      <Link
        href="/tablette/paiement"
        className="fixed bottom-3 left-[92px] z-40 inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/70 px-2 py-1 text-[10px] text-white/80 hover:bg-black/90"
      >
        <Info className="h-3 w-3" />
        Info
      </Link>

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
