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
import { listCatalogItemsUnified } from '@/lib/itemsApi'
import { Box, ArrowDownRight, ArrowUpRight, Receipt, ShoppingCart, ChevronRight, Bug, MessageSquare, LifeBuoy, Info, X, Wallet, PlusCircle, ChevronUp, ChevronDown, Image as ImageIcon, Shapes, Pill, Swords, Shield } from 'lucide-react'
import { computeItemStockCategoryStats } from '@/lib/itemStockStats'
import { useUiThemeConfig } from '@/hooks/useUiThemeConfig'

type Tx = {
  id: string
  source: string
  entry_id: string
  type: 'purchase' | 'stock_in' | 'sale' | 'stock_out'
  category: FinanceCategory
  total: number | null
  counterparty: string | null
  created_at: string
  item_image_url: string | null
  transaction_items?: { name_snapshot: string | null; quantity: number | null }[] | null
}

type Expense = { id: string; item_label: string; total: number; quantity: number; created_at: string; item_image_url: string | null }
type ActivityView = 'summary' | 'transactions' | 'expenses' | 'stock'
type StockActivityCategory = 'all' | 'objects' | 'weapons' | 'equipment' | 'drugs'
type StockBubbleKey = 'all' | 'objects' | 'weapons' | 'equipment' | 'drugs' | 'custom'

type CardKey = 'catObjects' | 'catWeapons' | 'catEquipment' | 'catDrugs' | 'mvExpense' | 'mvPurchase' | 'mvSale' | 'calculator'

type DashboardMetrics = {
  loading: boolean
  categoryCounts: Record<FinanceCategory, number>
  movementCounts: Record<FinanceMovementType, number>
}

type CardOption = { key: CardKey; title: string; href: string; icon: LucideIcon; getValue: (metrics: DashboardMetrics) => string }

type BubbleStyle = {
  bgColor?: string
  borderColor?: string
  textColor?: string
  iconBgColor?: string
  iconColor?: string
}

const CARD_OPTIONS: CardOption[] = [
  { key: 'catObjects', title: 'Achat', href: '/finance/achat-vente?mode=buy', icon: ArrowDownRight, getValue: (v) => (v.loading ? '—' : String(v.movementCounts.purchase)) },
  { key: 'catWeapons', title: 'Vente', href: '/finance/achat-vente?mode=sell', icon: ArrowUpRight, getValue: (v) => (v.loading ? '—' : String(v.movementCounts.sale)) },
  { key: 'catEquipment', title: 'Entrée', href: '/finance/entree-sortie?mode=buy', icon: ArrowDownRight, getValue: (v) => (v.loading ? '—' : String(v.movementCounts.stock_in)) },
  { key: 'catDrugs', title: 'Sortie', href: '/finance/entree-sortie?mode=sell', icon: ArrowUpRight, getValue: (v) => (v.loading ? '—' : String(v.movementCounts.stock_out)) },
  { key: 'mvExpense', title: 'Dépenses', href: '/finance?type=expense', icon: Wallet, getValue: (v) => (v.loading ? '—' : String(v.movementCounts.expense)) },
  { key: 'mvPurchase', title: 'Achats', href: '/finance?type=purchase', icon: ShoppingCart, getValue: (v) => (v.loading ? '—' : String(v.movementCounts.purchase)) },
  { key: 'mvSale', title: 'Ventes', href: '/finance?type=sale', icon: ArrowUpRight, getValue: (v) => (v.loading ? '—' : String(v.movementCounts.sale)) },
  { key: 'calculator', title: 'Calculateur', href: '/drogues', icon: Receipt, getValue: () => '→' },
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

function createEmptyCategoryCounts(): Record<FinanceCategory, number> {
  return { objects: 0, weapons: 0, equipment: 0, drugs: 0, custom: 0, other: 0 }
}

function createEmptyMovementCounts(): Record<FinanceMovementType, number> {
  return { expense: 0, purchase: 0, stock_in: 0, sale: 0, stock_out: 0 }
}

function stockCategoryLabel(key: StockBubbleKey) {
  if (key === 'all') return 'Tous'
  if (key === 'objects') return 'Objets'
  if (key === 'weapons') return 'Armes'
  if (key === 'equipment') return 'Équipement'
  if (key === 'drugs') return 'Drogues'
  return 'Autres'
}

export function DashboardClient() {
  const themeConfig = useUiThemeConfig()
  const [loading, setLoading] = useState(true)
  const [recentTx, setRecentTx] = useState<Tx[]>([])
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])

  const [financeCategoryCounts, setFinanceCategoryCounts] = useState<Record<FinanceCategory, number>>(createEmptyCategoryCounts)
  const [financeMovementCounts, setFinanceMovementCounts] = useState<Record<FinanceMovementType, number>>(createEmptyMovementCounts)
  const [activityView, setActivityView] = useState<ActivityView>('summary')
  const [stockActivityCategory, setStockActivityCategory] = useState<StockActivityCategory>('all')
  const [pauseAutoUntil, setPauseAutoUntil] = useState(0)
  const [ticketKind, setTicketKind] = useState<'bug' | 'message'>('bug')
  const [ticketMessage, setTicketMessage] = useState('')
  const [ticketImage, setTicketImage] = useState<File | null>(null)
  const [ticketStatus, setTicketStatus] = useState('')
  const [supportOpen, setSupportOpen] = useState(false)
  const supportPanelRef = useRef<HTMLDivElement | null>(null)
  const cardLongPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)
  const [dashboardCards, setDashboardCards] = useState<CardKey[]>(DEFAULT_DASHBOARD_CARDS)
  const [uiLayoutsReady, setUiLayoutsReady] = useState(false)
  const [cardManagerOpen, setCardManagerOpen] = useState(false)
  const [cardPickerSlot, setCardPickerSlot] = useState<number | null>(null)
  const ticketPreviewUrl = useMemo(() => (ticketImage ? URL.createObjectURL(ticketImage) : null), [ticketImage])

  const visibleCustomDashboardBubbles = useMemo(() => (
    themeConfig.customDashboardBubbles.filter((entry) => entry.title.trim().toLowerCase() !== 'nouvelle bulle')
  ), [themeConfig.customDashboardBubbles])

  const iconByName: Record<string, LucideIcon> = {
    Wallet,
    PlusCircle,
    Receipt,
    Box,
    Shapes,
    Pill,
    Swords,
    Shield,
    ShoppingCart,
    ArrowUpRight,
    ArrowDownRight,
  }

  function getBubbleOverride(key: string) {
    return themeConfig.bubbles[key] || null
  }



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
        const cardsRes = await fetch('/api/ui-layouts?page_key=dashboard.cards', { cache: 'no-store' })
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

  async function persistLayouts(nextCards = dashboardCards) {
    await fetch('/api/ui-layouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_key: 'dashboard.cards', order: nextCards, scope_type: 'group' }),
    })
  }

  useEffect(() => {
    let alive = true
    const loadDashboardData = async () => {
      setLoading(true)
      try {
        currentGroupId()
        const [financeEntries, catalogItems] = await Promise.all([listFinanceEntries(), listCatalogItemsUnified()])

        if (!alive) return

        const stockCategoryStats = computeItemStockCategoryStats(catalogItems)
        const categoryCounts = createEmptyCategoryCounts()
        const movementCounts = createEmptyMovementCounts()

        categoryCounts.objects = stockCategoryStats.objects
        categoryCounts.weapons = stockCategoryStats.weapons
        categoryCounts.equipment = stockCategoryStats.equipment
        categoryCounts.drugs = stockCategoryStats.drugs
        categoryCounts.custom = stockCategoryStats.other

        for (const entry of financeEntries) {
          movementCounts[entry.movement_type] += 1
        }

        const recentFinanceTransactions: Tx[] = financeEntries
          .filter((entry) => entry.movement_type === 'purchase' || entry.movement_type === 'stock_in' || entry.movement_type === 'sale' || entry.movement_type === 'stock_out')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 8)
          .map((entry) => ({
            id: `${entry.source}-${entry.id}`,
            source: entry.source,
            entry_id: entry.id,
            type: entry.movement_type === 'purchase' ? 'purchase' : entry.movement_type === 'stock_in' ? 'stock_in' : entry.movement_type === 'stock_out' ? 'stock_out' : 'sale',
            category: entry.category,
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
    }

    void loadDashboardData().catch(() => {
      if (alive) setLoading(false)
    })

    const intervalId = window.setInterval(() => {
      if (document.hidden) return
      void loadDashboardData().catch(() => undefined)
    }, 5000)

    const onWindowFocus = () => {
      void loadDashboardData().catch(() => undefined)
    }

    const onVisibility = () => {
      if (!document.hidden) void loadDashboardData().catch(() => undefined)
    }

    window.addEventListener('focus', onWindowFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      alive = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onWindowFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    const views: ActivityView[] = ['summary', 'transactions', 'expenses', 'stock']
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
    const totalOps = financeMovementCounts.expense + financeMovementCounts.purchase + financeMovementCounts.stock_in + financeMovementCounts.sale + financeMovementCounts.stock_out
    const totalAmountTx = recentTx.reduce((sum, tx) => sum + (Number(tx.total ?? 0) || 0), 0)
    const totalAmountExpenses = recentExpenses.reduce((sum, expense) => sum + (Number(expense.total ?? 0) || 0), 0)
    return {
      totalOps,
      totalAmountTx,
      totalAmountExpenses,
    }
  }, [financeMovementCounts, recentExpenses, recentTx])

  const stockActivityRows = useMemo(() => (
    recentTx.filter((tx) => (stockActivityCategory === 'all' ? true : tx.category === stockActivityCategory))
  ), [recentTx, stockActivityCategory])

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
    void persistLayouts(finalOrder)
  }

  function moveDashboardCard(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= dashboardCards.length) return
    const next = [...dashboardCards]
    const [entry] = next.splice(index, 1)
    next.splice(targetIndex, 0, entry)
    setDashboardCards(next)
    void persistLayouts(next)
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_332px]">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {!uiLayoutsReady ? Array.from({ length: 4 }).map((_, idx) => (
            <div key={`card-skeleton-${idx}`} className="h-[118px] rounded-2xl border border-white/10 bg-white/[0.03] animate-pulse" />
          )) : null}
          {uiLayoutsReady ? dashboardCards.map((cardKey, idx) => {
            const card = CARD_OPTIONS.find((c) => c.key === cardKey) || CARD_OPTIONS[idx] || CARD_OPTIONS[0]
            const override = getBubbleOverride(`dashboard.card.${card.key}`)
            const Icon = (override?.icon && iconByName[override.icon]) ? iconByName[override.icon] : card.icon
            return (
              <div key={`${card.key}-${idx}`} className="select-none touch-none" onPointerDown={onCardPointerDown} onPointerUp={onCardPointerEnd} onPointerLeave={onCardPointerEnd} onPointerCancel={onCardPointerEnd} onClickCapture={onCardClickCapture}>
              <StatCard
                title={override?.label || card.title}
                value={card.getValue({ loading, categoryCounts: financeCategoryCounts, movementCounts: financeMovementCounts })}
                icon={<Icon className="h-5 w-5" />}
                bubbleStyle={{
                  bgColor: override?.bgColor,
                  borderColor: override?.borderColor,
                  textColor: override?.textColor,
                  iconBgColor: override?.iconBgColor,
                  iconColor: override?.iconColor,
                }}
                tone={
                  card.key === 'catWeapons' ? 'rose'
                    : card.key === 'catEquipment' ? 'amber'
                    : card.key === 'catDrugs' ? 'emerald'
                    : card.key === 'catObjects' ? 'cyan'
                    : card.key === 'mvExpense' ? 'amber'
                    : card.key === 'mvPurchase' ? 'emerald'
                    : card.key === 'mvSale' ? 'rose'
                    : 'slate'
                }
                href={card.href}
              />
              </div>
            )
          }) : null}
        </div>

        {visibleCustomDashboardBubbles.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {visibleCustomDashboardBubbles.map((entry) => {
              const Icon = (entry.icon && iconByName[entry.icon]) ? iconByName[entry.icon] : Shapes
              const bubbleStyle: BubbleStyle = {
                bgColor: entry.bgColor,
                borderColor: entry.borderColor,
                textColor: entry.textColor,
                iconBgColor: entry.bgColor,
                iconColor: entry.textColor,
              }
              return (
                <StatCard
                  key={entry.id}
                  title={entry.title}
                  value={entry.value || '—'}
                  icon={<Icon className="h-5 w-5" />}
                  tone="slate"
                  href={entry.href}
                  bubbleStyle={bubbleStyle}
                />
              )
            })}
          </div>
        ) : null}

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
              { key: 'summary', label: 'Résumé', active: 'border-violet-300/65 bg-gradient-to-r from-violet-500/35 to-fuchsia-500/30 text-violet-50', idle: 'border-violet-300/25 bg-violet-500/10 text-violet-100/85 hover:bg-violet-500/18' },
              { key: 'transactions', label: 'Transactions', active: 'border-cyan-300/65 bg-gradient-to-r from-cyan-500/35 to-blue-500/30 text-cyan-50', idle: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100/85 hover:bg-cyan-500/18' },
              { key: 'expenses', label: 'Dépenses', active: 'border-amber-300/65 bg-gradient-to-r from-amber-500/35 to-orange-500/30 text-amber-50', idle: 'border-amber-300/25 bg-amber-500/10 text-amber-100/85 hover:bg-amber-500/18' },
              { key: 'stock', label: 'Stock', active: 'border-emerald-300/65 bg-gradient-to-r from-emerald-500/35 to-teal-500/30 text-emerald-50', idle: 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100/85 hover:bg-emerald-500/18' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectActivity(tab.key as ActivityView)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${activityView === tab.key ? tab.active : tab.idle}`}
              >
                {tab.label}
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
                          t.type === 'purchase' || t.type === 'stock_in'
                            ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'
                            : 'border-orange-300/40 bg-orange-500/10 text-orange-100'
                        }`}
                      >
                        {t.type === 'purchase' || t.type === 'stock_in' ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {t.type === 'purchase' || t.type === 'stock_in' ? 'Entrée' : 'Sortie'}
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
            {activityView === 'stock' ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'all', label: 'Tous' },
                    { key: 'objects', label: 'Objets' },
                    { key: 'weapons', label: 'Armes' },
                    { key: 'equipment', label: 'Équipement' },
                    { key: 'drugs', label: 'Drogues' },
                  ].map((pill) => (
                    <button
                      key={pill.key}
                      type="button"
                      onClick={() => setStockActivityCategory(pill.key as StockActivityCategory)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        stockActivityCategory === pill.key
                          ? 'border-cyan-300/65 bg-gradient-to-r from-cyan-500/30 to-blue-500/28 text-cyan-50'
                          : 'border-white/15 bg-white/[0.04] text-white/75 hover:bg-white/[0.09]'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
                {stockActivityRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">Aucune activité stock pour ce filtre.</div>
                ) : (
                  stockActivityRows.map((t) => (
                    <Link href={`/finance/transactions/${t.source}/${encodeURIComponent(t.entry_id)}`} key={`stock-${t.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 transition hover:bg-white/[0.06]">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                          {t.item_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={t.item_image_url} alt={t.counterparty || 'Stock'} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-4 w-4" /></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            <span
                              className={`mr-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                                t.type === 'purchase' || t.type === 'stock_in'
                                  ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'
                                  : 'border-orange-300/40 bg-orange-500/10 text-orange-100'
                              }`}
                            >
                              {t.type === 'purchase' || t.type === 'stock_in' ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                              {t.type === 'purchase' || t.type === 'stock_in' ? 'Entrée' : 'Sortie'}
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
                )}
              </>
            ) : null}
          </div>
        </Panel>

      </div>

      <div className="flex h-full flex-col gap-4">
        <Panel>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Stock par catégorie</h3>
            <div className="flex items-center gap-1">
              <Link href="/coke/preparer" className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/25 bg-cyan-500/12 px-2.5 py-1 text-xs text-cyan-50 hover:bg-cyan-500/20">
                Session coke
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/items" className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs text-white/90 hover:bg-white/[0.12]">
                Ouvrir Items
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <p className="mt-1 text-sm text-white/60">Vue stock en temps réel (source Items)</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([
              { key: 'all', value: financeCategoryCounts.objects + financeCategoryCounts.weapons + financeCategoryCounts.equipment + financeCategoryCounts.drugs + financeCategoryCounts.custom, icon: Shapes, href: '/items?category=all' },
              { key: 'objects', value: financeCategoryCounts.objects, icon: Box, href: '/items?category=objects' },
              { key: 'weapons', value: financeCategoryCounts.weapons, icon: Swords, href: '/items?category=weapons' },
              { key: 'equipment', value: financeCategoryCounts.equipment, icon: Shield, href: '/items?category=equipment' },
              { key: 'drugs', value: financeCategoryCounts.drugs, icon: Pill, href: '/items?category=drugs' },
              { key: 'custom', value: financeCategoryCounts.custom, icon: Shapes, href: '/items?category=custom' },
            ] as { key: StockBubbleKey; value: number; icon: LucideIcon; href: string }[]).map((card) => {
              const Icon = card.icon
              const override = themeConfig.bubbles[`items.category.${card.key}`]
              const label = stockCategoryLabel(card.key)
              return (
                <Link
                  key={card.key}
                  href={card.href}
                  className={`rounded-2xl border px-3 py-3 text-left transition min-h-[108px] ${
                    card.key === 'objects'
                      ? 'border-cyan-300/20 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.13]'
                      : card.key === 'weapons'
                        ? 'border-rose-300/20 bg-rose-500/[0.06] hover:bg-rose-500/[0.13]'
                        : card.key === 'equipment'
                          ? 'border-amber-300/20 bg-amber-700/[0.16] hover:bg-amber-700/[0.24]'
                          : card.key === 'drugs'
                            ? 'border-emerald-300/20 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.13]'
                            : card.key === 'custom'
                              ? 'border-slate-300/20 bg-slate-500/[0.06] hover:bg-slate-500/[0.13]'
                              : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'
                  }`}
                  style={{
                    background: override?.bgColor || undefined,
                    borderColor: override?.borderColor || undefined,
                    color: override?.textColor || undefined,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-white/70">{label}</p>
                    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/80">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <p className="mt-5 text-2xl font-semibold leading-none">{card.value}</p>
                </Link>
              )
            })}
          </div>
        </Panel>

      </div>
    </div>


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
