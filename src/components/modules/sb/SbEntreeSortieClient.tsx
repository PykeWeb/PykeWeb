'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Box, Loader2, Minus, Plus, Search, Shield, Swords, Trash2, Pill, Shapes, Layers, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { createCatalogItem, createFinanceTransaction, listCatalogItemsUnified } from '@/lib/itemsApi'
import { markStockInNote, markStockOutNote } from '@/lib/financeStockFlow'
import { getTypeFilterOptions, matchesTypeFilter, normalizeCatalogCategory, type UnifiedTypeFilterValue } from '@/lib/catalogConfig'
import { computeItemStockCategoryStats } from '@/lib/itemStockStats'
import { getTenantSession } from '@/lib/tenantSession'
import type { CatalogItem, ItemCategory } from '@/lib/types/itemsFinance'

type Mode = 'entree' | 'sortie'
type FilterCategory = 'all' | ItemCategory
const CUSTOM_FREE_INPUT_ITEM_ID = '__custom_free_input__'

type SelectedItem = {
  mode: Mode
  id: string
  selectionKey: string
  name: string
  quantity: number
  price: number
  imageUrl?: string
  category?: ItemCategory | 'custom'
  buyPrice?: number
  sellPrice?: number
  isManual?: boolean
  manualLabel?: string
}

function resolveModePrice(item: CatalogItem, mode: Mode) {
  if (mode === 'entree') return Math.max(0, Number(item.buy_price || item.sell_price || item.internal_value || 0))
  return Math.max(0, Number(item.sell_price || item.buy_price || item.internal_value || 0))
}

type SbPageVariant = 'stockFlow' | 'trade'

type SbEntreeSortieClientProps = {
  variant?: SbPageVariant
}

export function SbEntreeSortieClient({ variant = 'stockFlow' }: SbEntreeSortieClientProps) {
  const [mode, setMode] = useState<Mode>('entree')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FilterCategory>('all')
  const [type, setType] = useState<UnifiedTypeFilterValue>('all')
  const [counterparty, setCounterparty] = useState('')
  const [defaultMemberName, setDefaultMemberName] = useState('')
  const [member, setMember] = useState('')
  const [memberOptions, setMemberOptions] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({})
  const [methKitMachines, setMethKitMachines] = useState('1')
  const [methKitUnitPrice, setMethKitUnitPrice] = useState('3300')
  const [showMethKitEditor, setShowMethKitEditor] = useState(false)
  const memberSelectOptions = useMemo(() => {
    const current = member.trim()
    if (!current) return memberOptions
    return memberOptions.some((name) => name.toLowerCase() === current.toLowerCase()) ? memberOptions : [current, ...memberOptions]
  }, [member, memberOptions])

  useEffect(() => {
    const session = getTenantSession()
    const sessionMember = String(session?.memberName || '').trim()
    if (sessionMember) {
      setDefaultMemberName(sessionMember)
      setMember(sessionMember)
    }

    void listCatalogItemsUnified()
      .then((rows) => setItems(rows))
      .catch(() => {
        toast.error('Impossible de charger les articles.')
        setItems([])
      })
      .finally(() => setIsLoading(false))

    void fetch('/api/group/members', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return []
        const payload = (await res.json()) as { members?: string[] }
        return Array.isArray(payload.members) ? payload.members : []
      })
      .then((rows) => setMemberOptions(rows))
      .catch(() => setMemberOptions([]))
  }, [])

  const stats = useMemo(() => computeItemStockCategoryStats(items), [items])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return items.filter((item) => {
      const normalizedCategory = normalizeCatalogCategory(item.category) || 'objects'
      if (category !== 'all' && normalizedCategory !== category) return false
      if (!matchesTypeFilter(item, category, type)) return false
      if (mode === 'sortie' && Math.max(0, Number(item.stock || 0)) <= 0) return false
      if (!normalizedQuery) return true
      return item.name.toLowerCase().includes(normalizedQuery)
    })
  }, [items, category, mode, query, type])

  const stockById = useMemo(() => (
    Object.fromEntries(items.map((item) => [item.id, Math.max(0, Number(item.stock || 0))]))
  ), [items])

  const safeTotalItems = useMemo(
    () => selectedItems.reduce((sum, entry) => sum + Math.max(0, Number(entry.quantity || 0)), 0),
    [selectedItems]
  )

  const tradeTotals = useMemo(() => {
    const buyTotal = selectedItems
      .filter((entry) => entry.mode === 'entree')
      .reduce((sum, entry) => sum + (entry.quantity * Math.max(0, Number(entry.price || 0))), 0)
    const sellTotal = selectedItems
      .filter((entry) => entry.mode === 'sortie')
      .reduce((sum, entry) => sum + (entry.quantity * Math.max(0, Number(entry.price || 0))), 0)
    return {
      buyTotal,
      sellTotal,
      net: sellTotal - buyTotal,
    }
  }, [selectedItems])

  function findItemByAliases(aliases: string[]) {
    const normalizedAliases = aliases.map((alias) => alias.trim().toLowerCase())
    return items.find((item) => normalizedAliases.some((alias) => item.name.trim().toLowerCase().includes(alias))) || null
  }

  const addItem = (item: CatalogItem, increment = 1) => {
    const baseQuantity = Math.max(1, Math.floor(Number(increment) || 1))
    const maxStock = Math.max(0, Number(item.stock || 0))
    const safeQuantity = mode === 'sortie' ? Math.min(baseQuantity, maxStock) : baseQuantity
    if (mode === 'sortie' && safeQuantity <= 0) return
    const normalizedCategory = normalizeCatalogCategory(item.category) || 'custom'

    setSelectedItems((prev) => {
      const index = prev.findIndex((entry) => entry.id === item.id && !entry.isManual && entry.mode === mode)
      if (index >= 0) {
        const next = [...prev]
        const nextQuantity = mode === 'sortie'
          ? Math.min(next[index].quantity + safeQuantity, maxStock)
          : next[index].quantity + safeQuantity
        next[index] = { ...next[index], quantity: nextQuantity }
        return next
      }
      const buyPrice = Math.max(0, Number(item.buy_price || item.internal_value || item.sell_price || 0))
      const sellPrice = Math.max(0, Number(item.sell_price || item.internal_value || item.buy_price || 0))
      return [...prev, {
        id: item.id,
        mode,
        selectionKey: `${item.id}:${mode}`,
        name: item.name,
        quantity: safeQuantity,
        price: resolveModePrice(item, mode),
        imageUrl: item.image_url ?? undefined,
        category: normalizedCategory,
        buyPrice,
        sellPrice,
      }]
    })
  }

  useEffect(() => {
    if (variant !== 'trade') return
    void listCatalogItemsUnified().then(setItems).catch(() => undefined)
  }, [mode, variant])

  useEffect(() => {
    if (variant !== 'trade') return
    setSelectedItems((prev) => prev.map((entry) => {
      const item = items.find((row) => row.id === entry.id)
      if (!item) return entry
      const buyPrice = Math.max(0, Number(item.buy_price || item.internal_value || item.sell_price || 0))
      const sellPrice = Math.max(0, Number(item.sell_price || item.internal_value || item.buy_price || 0))
      return { ...entry, price: resolveModePrice(item, entry.mode), buyPrice, sellPrice }
    }))
  }, [items, mode, variant])

  const removeItem = (itemId: string) => {
    setSelectedItems((prev) => prev.filter((entry) => entry.selectionKey !== itemId))
  }

  const updateQuantity = (itemId: string, quantity: number) => {
    setSelectedItems((prev) => prev.map((entry) => (
      entry.selectionKey === itemId
        ? {
          ...entry,
          ...(entry.mode === 'sortie' ? (() => {
            const maxStock = stockById[entry.id] ?? 0
            return {
              quantity: Math.max(1, Math.min(Math.floor(quantity || 1), Math.max(1, entry.isManual ? Number.MAX_SAFE_INTEGER : maxStock))),
            }
          })() : { quantity: Math.max(1, Math.floor(quantity || 1)) }),
        }
        : entry
    )))
    setQuantityDrafts((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
  }

  const updatePrice = (itemId: string, price: number) => {
    setSelectedItems((prev) => prev.map((entry) => (
      entry.selectionKey === itemId ? { ...entry, price: Math.max(0, Number(price || 0)) } : entry
    )))
  }

  const updateManualLabel = (itemId: string, value: string) => {
    setSelectedItems((prev) => prev.map((entry) => (
      entry.selectionKey === itemId ? { ...entry, manualLabel: value } : entry
    )))
  }

  const clearTransaction = () => {
    setSelectedItems([])
    setQuantityDrafts({})
    setCounterparty('')
    setMember(defaultMemberName)
    setMethKitMachines('1')
    setMethKitUnitPrice('3300')
    setShowMethKitEditor(false)
  }

  function addMethKitToSelection() {
    const machineQty = Math.max(1, Math.floor(Number(methKitMachines || 1) || 1))
    const machineUnitPrice = Math.max(0, Number(methKitUnitPrice || 0))

    const machine = findItemByAliases(['machine de meth', 'machine meth'])
    const battery = findItemByAliases(['batterie', 'battery'])
    const ammonia = findItemByAliases(['ammoniaque', 'ammonia'])
    const methylamine = findItemByAliases(['methylamine', 'méthylamine'])

    if (!machine || !battery || !ammonia || !methylamine) {
      toast.error('Kit meth incomplet: vérifie les items Machine/Batterie/Ammoniaque/Methylamine.')
      return
    }

    addItem(machine, machineQty)
    addItem(battery, machineQty * 2)
    addItem(ammonia, machineQty * 6)
    addItem(methylamine, machineQty * 5)

    setSelectedItems((prev) => prev.map((entry) => {
      if (entry.id === machine.id) return { ...entry, price: machineUnitPrice }
      if (entry.id === battery.id || entry.id === ammonia.id || entry.id === methylamine.id) return { ...entry, price: 0 }
      return entry
    }))
    toast.success('Kit complet meth ajouté.')
  }

  function closeMethKitEditor() {
    setShowMethKitEditor(false)
  }

  function addManualItemToSelection() {
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setSelectedItems((prev) => [
      ...prev,
      {
        id: `${CUSTOM_FREE_INPUT_ITEM_ID}:${uid}`,
        mode,
        selectionKey: `${CUSTOM_FREE_INPUT_ITEM_ID}:${uid}`,
        name: 'Autres / item non listé',
        quantity: 1,
        price: 0,
        imageUrl: '/images/finance/multi-expense.svg',
        category: 'custom',
        isManual: true,
        manualLabel: '',
      },
    ])
  }

  async function ensureManualCatalogItemId(label: string) {
    const normalized = label.trim().toLowerCase()
    const existing = items.find((item) => item.category === 'custom' && item.name.trim().toLowerCase() === normalized)
    if (existing?.id) return existing.id
    const created = await createCatalogItem({
      name: label.trim(),
      category: 'custom',
      item_type: 'other',
      buy_price: 0,
      sell_price: 0,
      internal_value: 0,
      show_in_finance: true,
      is_active: true,
      stock: 0,
      low_stock_threshold: 0,
      stackable: true,
      max_stack: 100,
      description: 'Créé automatiquement depuis Achat/Vente - Entrée/Sortie',
      imageFile: null,
      weight: null,
    })
    setItems((prev) => [created, ...prev])
    return created.id
  }

  const submitTransaction = async () => {
    if (selectedItems.length === 0) {
      toast.error('Ajoute au moins un article.')
      return
    }

    setIsSubmitting(true)
    try {
      for (const entry of selectedItems) {
        const manualLabel = entry.isManual ? (entry.manualLabel?.trim() || 'Autres / item non listé') : ''
        const baseNotes = [member.trim() ? `Membre: ${member.trim()}` : null, entry.isManual ? `Item non listé: ${manualLabel}` : null].filter(Boolean).join(' • ') || ''
        const notes = variant === 'stockFlow'
          ? (entry.mode === 'entree' ? markStockInNote(baseNotes) : markStockOutNote(baseNotes))
          : (baseNotes || undefined)
        const resolvedItemId = entry.isManual ? await ensureManualCatalogItemId(manualLabel) : entry.id
        await createFinanceTransaction({
          item_id: resolvedItemId,
          mode: entry.mode === 'entree' ? 'buy' : 'sell',
          quantity: entry.quantity,
          unit_price: variant === 'trade' ? entry.price : 0,
          counterparty: counterparty.trim() || (entry.isManual ? manualLabel : undefined),
          notes,
          payment_mode: 'other',
        })
      }

      toast.success('Transaction enregistrée.')
      clearTransaction()
      const refreshed = await listCatalogItemsUnified()
      setItems(refreshed)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible de valider la transaction.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isTradeVariant = variant === 'trade'
  const modeLeftLabel = isTradeVariant ? 'Achat' : 'Entrée'
  const modeRightLabel = isTradeVariant ? 'Vente' : 'Sortie'
  const headerTitle = isTradeVariant ? 'Achat / Vente' : 'Entrée / Sortie'
  const headerSubtitle = isTradeVariant
    ? 'Interface rapide achat/vente avec prix.'
    : 'Interface rapide entrée/sortie de stock.'

  useEffect(() => {
    setQuantityDrafts((prev) => {
      const allowed = new Set(selectedItems.map((entry) => entry.selectionKey))
      const next: Record<string, string> = {}
      for (const [key, value] of Object.entries(prev)) {
        if (allowed.has(key)) next[key] = value
      }
      return next
    })
  }, [selectedItems])

  return (
    <div className="space-y-4">
      <PageHeader title={headerTitle} subtitle={headerSubtitle} />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { key: 'all', label: 'Toutes', value: stats.all, icon: Layers, tone: 'from-slate-500/30 to-slate-700/20 border-slate-200/30' },
          { key: 'objects', label: 'Objets', value: stats.objects, icon: Box, tone: 'from-cyan-500/30 to-blue-600/20 border-cyan-200/35' },
          { key: 'weapons', label: 'Armes', value: stats.weapons, icon: Swords, tone: 'from-rose-500/30 to-red-600/20 border-rose-200/35' },
          { key: 'equipment', label: 'Équipement', value: stats.equipment, icon: Shield, tone: 'from-amber-600/35 to-orange-700/20 border-amber-200/35' },
          { key: 'drugs', label: 'Drogues', value: stats.drugs, icon: Pill, tone: 'from-emerald-500/30 to-teal-600/20 border-emerald-200/35' },
          { key: 'other', label: 'Autre(s)', value: stats.other, icon: Sparkles, tone: 'from-violet-500/30 to-fuchsia-600/20 border-violet-200/35' },
        ].map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => {
              setCategory(card.key === 'other' ? 'custom' : card.key as FilterCategory)
              setType('all')
            }}
            className={`min-h-[92px] rounded-2xl border px-3 py-3 text-left transition ${
              category === (card.key === 'other' ? 'custom' : card.key)
                ? `${card.tone} bg-gradient-to-br shadow-[0_0_20px_rgba(34,211,238,0.2)]`
                : `${card.tone} bg-gradient-to-br opacity-80 hover:opacity-100`
            }`}
          >
            <div className="flex items-center gap-2 text-xs text-white/80">
              <card.icon className="h-4 w-4" />
              <p>{card.label}</p>
            </div>
            <p className="mt-4 text-2xl font-semibold leading-none">{card.value}</p>
          </button>
        ))}
      </div>

      <Panel className="space-y-4">
        <div className="flex justify-center">
          <div className="inline-flex rounded-full border border-cyan-200/35 bg-[#0c1430]/80 p-1">
            <button
              type="button"
              onClick={() => setMode('entree')}
              className={`inline-flex min-w-[170px] items-center justify-center gap-2 rounded-full px-6 py-2 text-xl font-semibold transition ${mode === 'entree' ? 'bg-gradient-to-r from-cyan-500/45 to-blue-500/40 text-cyan-50 shadow-[0_0_30px_rgba(56,189,248,0.45)]' : 'text-white/70 hover:text-white'}`}
            >
              <ArrowDown className="h-5 w-5" />
              {modeLeftLabel}
            </button>
            <button
              type="button"
              onClick={() => setMode('sortie')}
              className={`inline-flex min-w-[170px] items-center justify-center gap-2 rounded-full px-6 py-2 text-xl font-semibold transition ${mode === 'sortie' ? 'bg-gradient-to-r from-cyan-500/45 to-blue-500/40 text-cyan-50 shadow-[0_0_30px_rgba(56,189,248,0.45)]' : 'text-white/70 hover:text-white'}`}
            >
              <ArrowUp className="h-5 w-5" />
              {modeRightLabel}
            </button>
          </div>
        </div>
        <div className={`grid gap-3 ${isTradeVariant ? 'xl:grid-cols-[1fr_1fr_auto_auto_auto_auto]' : 'xl:grid-cols-[1fr_1fr_auto_auto_auto]'}`}>
          <Input value={counterparty} onChange={(event) => setCounterparty(event.target.value)} placeholder="Interlocuteur" className="h-11" />
          <select
            value={member}
            onChange={(event) => setMember(event.target.value)}
            className="h-11 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm text-white outline-none transition focus:border-white/30 focus:bg-white/[0.1]"
          >
            <option value="" className="bg-[#0b1228] text-white">Choisir un joueur</option>
            {memberSelectOptions.map((name) => <option key={name} value={name} className="bg-[#0b1228] text-white">{name}</option>)}
          </select>
          <div className="inline-flex h-11 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-500/10 px-5 text-sm font-semibold text-cyan-100">
            <span>Qté : {safeTotalItems}</span>
          </div>
          {isTradeVariant ? (
            <div className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 text-xs font-semibold text-emerald-100">
              <span>Achat: {tradeTotals.buyTotal.toFixed(2)} $</span>
              <span>•</span>
              <span>Vente: {tradeTotals.sellTotal.toFixed(2)} $</span>
              <span>•</span>
              <span className={`rounded-full px-2 py-0.5 ${tradeTotals.net >= 0 ? 'bg-emerald-500/25 text-emerald-100' : 'bg-rose-500/25 text-rose-100'}`}>
                Net: {tradeTotals.net.toFixed(2)} $
              </span>
            </div>
          ) : null}
          <SecondaryButton onClick={clearTransaction} className="h-11 px-6">Annuler</SecondaryButton>
          <PrimaryButton onClick={() => void submitTransaction()} disabled={isSubmitting} className="h-11 px-6">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Valider
          </PrimaryButton>
        </div>

      </Panel>

      <div className="grid gap-4 xl:grid-cols-5 xl:items-stretch">
        <Panel className="flex h-full max-h-[44vh] flex-col space-y-4 xl:col-span-3">
          <div className="grid gap-2 md:grid-cols-[180px_1fr]">
            <GlassSelect
              value={type}
              onChange={(value) => setType(value as UnifiedTypeFilterValue)}
              options={getTypeFilterOptions(category).map((option) => ({ value: option.value, label: option.label }))}
              placeholder="Type"
            />
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Recherche" className="pl-10" />
            </label>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {isLoading ? <p className="py-10 text-center text-white/60">Chargement des articles…</p> : null}
            {!isLoading && filteredItems.length === 0 ? <p className="py-10 text-center text-white/60">Aucun article trouvé.</p> : null}
            {category === 'custom' ? (
              <div
                role="button"
                tabIndex={0}
                onClick={addManualItemToSelection}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    addManualItemToSelection()
                  }
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-violet-300/25 bg-violet-500/[0.08] px-3 py-2 text-left transition hover:border-violet-300/45 hover:bg-violet-500/[0.14]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-lg border border-violet-300/35 bg-violet-500/[0.14]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/finance/multi-expense.svg" alt="Autres item non listé" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">Autres / item non listé</p>
                    <p className="text-xs text-white/70">Ajoute une ligne libre (multi sélection).</p>
                  </div>
                </div>
              </div>
            ) : null}
            {isTradeVariant && mode === 'entree' && category === 'drugs' ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setShowMethKitEditor(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setShowMethKitEditor(true)
                  }
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-cyan-300/25 bg-cyan-500/[0.08] px-3 py-2 text-left transition hover:border-cyan-300/45 hover:bg-cyan-500/[0.14]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-lg border border-cyan-300/35 bg-cyan-500/[0.14]">
                    <Pill className="h-5 w-5 text-cyan-100" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">Achat kit complet Meth</p>
                    <p className="text-xs text-white/70">Ajoute machine + accessoires avec prix machine modifiable.</p>
                  </div>
                </div>
              </div>
            ) : null}
            {filteredItems.map((item) => {
              const normalizedCategory = normalizeCatalogCategory(item.category) || 'custom'
              const CategoryIcon =
                normalizedCategory === 'objects' ? Box
                  : normalizedCategory === 'weapons' ? Swords
                    : normalizedCategory === 'equipment' ? Shield
                      : normalizedCategory === 'drugs' ? Pill
                        : Shapes
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => addItem(item, 1)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      addItem(item, 1)
                    }
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-cyan-300/35 hover:bg-cyan-500/[0.06]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.08]">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : <CategoryIcon className="h-5 w-5 text-white/70" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                      <p className="text-xs text-white/60">
                        Stock: {Math.max(0, Number(item.stock || 0))}
                        {isTradeVariant ? ` · Achat: ${Math.max(0, Number(item.buy_price || item.internal_value || item.sell_price || 0)).toFixed(2)} $ · Vente: ${Math.max(0, Number(item.sell_price || item.internal_value || item.buy_price || 0)).toFixed(2)} $` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-cyan-100/90">
                    Stock: {Math.max(0, Number(item.stock || 0))}
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel className="flex h-full max-h-[44vh] flex-col xl:col-span-2">
          <h2 className="text-xl font-semibold text-white">Objets sélectionnés</h2>
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
            {showMethKitEditor && isTradeVariant && mode === 'entree' ? (
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/[0.08] p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-cyan-100">Kit complet Meth</p>
                  <button type="button" onClick={closeMethKitEditor} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300/35 bg-rose-500/15 text-rose-100">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <Input value={methKitMachines} onChange={(event) => setMethKitMachines(event.target.value)} inputMode="numeric" placeholder="Nb machines" className="h-9" />
                  <Input value={methKitUnitPrice} onChange={(event) => setMethKitUnitPrice(event.target.value)} inputMode="decimal" placeholder="Prix machine" className="h-9" />
                  <SecondaryButton onClick={addMethKitToSelection} className="h-9">Ajouter kit</SecondaryButton>
                </div>
              </div>
            ) : null}
            {selectedItems.length === 0 ? <p className="py-8 text-center text-sm text-white/55">Aucun objet sélectionné.</p> : null}
            {selectedItems.map((entry) => {
              const ItemIcon =
                entry.category === 'objects' ? Box
                  : entry.category === 'weapons' ? Swords
                    : entry.category === 'equipment' ? Shield
                      : entry.category === 'drugs' ? Pill
                        : Shapes
              return (
              <div key={entry.selectionKey} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.08]">
                      {entry.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.imageUrl} alt={entry.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : <ItemIcon className="h-5 w-5 text-white/70" />}
                    </div>
                    {entry.isManual ? (
                      <Input value={entry.manualLabel || ''} onChange={(event) => updateManualLabel(entry.selectionKey, event.target.value)} placeholder="Nom item non listé" className="h-8 max-w-[15rem]" />
                    ) : <p className="truncate text-sm font-semibold text-white">{entry.name}</p>}
                    <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/75">{entry.mode === 'entree' ? modeLeftLabel : modeRightLabel}</span>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/10 text-cyan-100" title={entry.mode === 'entree' ? 'Entrée stock' : 'Sortie stock'}>
                      {entry.mode === 'entree' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                    </span>
                  </div>
                  <button type="button" onClick={() => removeItem(entry.selectionKey)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300/35 bg-rose-500/15 text-rose-100">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-white/15 bg-white/[0.04]">
                    <button
                      type="button"
                      onClick={() => updateQuantity(entry.selectionKey, entry.quantity - 1)}
                      className="inline-flex h-full w-9 items-center justify-center border-r border-white/10 text-white/90"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <Input
                      value={quantityDrafts[entry.selectionKey] ?? String(entry.quantity)}
                      onChange={(event) => setQuantityDrafts((prev) => ({ ...prev, [entry.selectionKey]: event.target.value }))}
                      onBlur={() => {
                        const raw = quantityDrafts[entry.selectionKey]
                        if (raw == null) return
                        const parsed = Number(raw)
                        updateQuantity(entry.selectionKey, Number.isFinite(parsed) ? parsed : entry.quantity)
                      }}
                      inputMode="numeric"
                      className="h-full w-16 rounded-none border-0 bg-transparent px-2 text-center text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => updateQuantity(entry.selectionKey, entry.quantity + 1)}
                      className="inline-flex h-full w-9 items-center justify-center border-l border-white/10 text-white/90"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {isTradeVariant ? (
                    <div className="ml-2 flex items-center gap-2">
                      <span className="text-[11px] text-white/60">A: {(entry.buyPrice ?? 0).toFixed(2)}$ · V: {(entry.sellPrice ?? 0).toFixed(2)}$</span>
                      <span className="text-xs text-white/65">PU</span>
                      <Input
                        value={entry.price}
                        onChange={(event) => updatePrice(entry.selectionKey, Number(event.target.value))}
                        inputMode="decimal"
                        className="h-9 w-24 text-right text-sm"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            )})}
          </div>
        </Panel>
      </div>
    </div>
  )
}
