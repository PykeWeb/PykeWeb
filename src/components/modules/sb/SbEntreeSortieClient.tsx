'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Box, Layers, Loader2, Minus, Pill, Plus, Search, Shapes, Shield, Sparkles, Swords, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { getTypeFilterOptions, matchesTypeFilter, normalizeCatalogCategory, type UnifiedTypeFilterValue } from '@/lib/catalogConfig'
import { createFinanceTransaction, listCatalogItemsUnified } from '@/lib/itemsApi'
import { computeItemStockCategoryStats } from '@/lib/itemStockStats'
import type { CatalogItem, ItemCategory } from '@/lib/types/itemsFinance'

type Mode = 'entree' | 'sortie'
type FilterCategory = 'all' | ItemCategory
type SbPageVariant = 'stockFlow' | 'trade'

type SbEntreeSortieClientProps = {
  variant?: SbPageVariant
}

type SelectedItem = {
  id: string
  name: string
  quantity: number
  price: number
  imageUrl?: string
  category: ItemCategory
  buyPrice: number
  sellPrice: number
}

function resolveModePrice(item: CatalogItem, mode: Mode) {
  if (mode === 'entree') return Math.max(0, Number(item.buy_price || item.internal_value || item.sell_price || 0))
  return Math.max(0, Number(item.sell_price || item.internal_value || item.buy_price || 0))
}

export function SbEntreeSortieClient({ variant = 'stockFlow' }: SbEntreeSortieClientProps) {
  const [mode, setMode] = useState<Mode>('entree')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FilterCategory>('all')
  const [type, setType] = useState<UnifiedTypeFilterValue>('all')
  const [counterparty, setCounterparty] = useState('')
  const [member, setMember] = useState('')
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isTradeVariant = variant === 'trade'

  useEffect(() => {
    void listCatalogItemsUnified()
      .then((rows) => setItems(rows))
      .catch(() => {
        toast.error('Impossible de charger les articles.')
        setItems([])
      })
      .finally(() => setIsLoading(false))
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

  const stockById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, Math.max(0, Number(item.stock || 0))])),
    [items]
  )

  const safeTotalItems = useMemo(
    () => selectedItems.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0),
    [selectedItems]
  )

  const totalAmount = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity * Math.max(0, Number(item.price || 0)), 0),
    [selectedItems]
  )

  useEffect(() => {
    setSelectedItems((previous) => previous.map((entry) => {
      const source = items.find((item) => item.id === entry.id)
      if (!source) return entry
      const buyPrice = Math.max(0, Number(source.buy_price || source.internal_value || source.sell_price || 0))
      const sellPrice = Math.max(0, Number(source.sell_price || source.internal_value || source.buy_price || 0))
      return { ...entry, buyPrice, sellPrice, price: resolveModePrice(source, mode) }
    }))
  }, [items, mode])

  const addItem = (item: CatalogItem) => {
    const maxStock = Math.max(0, Number(item.stock || 0))
    if (mode === 'sortie' && maxStock <= 0) return
    const normalizedCategory = normalizeCatalogCategory(item.category) || 'custom'

    setSelectedItems((previous) => {
      const existingIndex = previous.findIndex((entry) => entry.id === item.id)
      if (existingIndex >= 0) {
        const next = [...previous]
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: mode === 'sortie'
            ? Math.min(next[existingIndex].quantity + 1, maxStock)
            : next[existingIndex].quantity + 1,
        }
        return next
      }

      const buyPrice = Math.max(0, Number(item.buy_price || item.internal_value || item.sell_price || 0))
      const sellPrice = Math.max(0, Number(item.sell_price || item.internal_value || item.buy_price || 0))
      return [...previous, {
        id: item.id,
        name: item.name,
        quantity: 1,
        price: resolveModePrice(item, mode),
        imageUrl: item.image_url ?? undefined,
        category: normalizedCategory,
        buyPrice,
        sellPrice,
      }]
    })
  }

  const removeItem = (itemId: string) => {
    setSelectedItems((previous) => previous.filter((entry) => entry.id !== itemId))
  }

  const updateQuantity = (itemId: string, quantity: number) => {
    const maxStock = stockById[itemId] ?? 0
    setSelectedItems((previous) => previous.map((entry) => {
      if (entry.id !== itemId) return entry
      return {
        ...entry,
        quantity: mode === 'sortie'
          ? Math.max(1, Math.min(Math.floor(quantity || 1), Math.max(1, maxStock)))
          : Math.max(1, Math.floor(quantity || 1)),
      }
    }))
  }

  const updatePrice = (itemId: string, price: number) => {
    setSelectedItems((previous) => previous.map((entry) => (
      entry.id === itemId ? { ...entry, price: Math.max(0, Number(price || 0)) } : entry
    )))
  }

  const clearTransaction = () => {
    setSelectedItems([])
    setCounterparty('')
    setMember('')
  }

  const submitTransaction = async () => {
    if (selectedItems.length === 0) {
      toast.error('Ajoute au moins un article.')
      return
    }

    setIsSubmitting(true)
    try {
      for (const item of selectedItems) {
        const notes = member.trim() ? `Membre: ${member.trim()}` : undefined
        await createFinanceTransaction({
          item_id: item.id,
          mode: mode === 'entree' ? 'buy' : 'sell',
          quantity: item.quantity,
          unit_price: isTradeVariant ? item.price : 0,
          counterparty: counterparty.trim() || undefined,
          notes,
          payment_mode: 'other',
        })
      }

      toast.success('Transaction enregistrée.')
      clearTransaction()
      const refreshed = await listCatalogItemsUnified()
      setItems(refreshed)
    } catch {
      toast.error('Erreur lors de l\'enregistrement.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const headerTitle = isTradeVariant ? 'Achat / Vente' : 'Entrée / Sortie'
  const headerSubtitle = isTradeVariant
    ? 'Interface rapide achat/vente avec prix pour tous les groupes.'
    : 'Interface rapide entrée/sortie de stock pour tous les groupes.'
  const modeLeftLabel = isTradeVariant ? 'Achat' : 'Entrée'
  const modeRightLabel = isTradeVariant ? 'Vente' : 'Sortie'

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
          { key: 'other', label: 'Autres', value: stats.other, icon: Sparkles, tone: 'from-violet-500/30 to-fuchsia-600/20 border-violet-200/35' },
        ].map((card) => {
          const cardCategory = card.key === 'other' ? 'custom' : card.key as FilterCategory
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                setCategory(cardCategory)
                setType('all')
              }}
              className={`min-h-[92px] rounded-2xl border px-3 py-3 text-left transition ${
                category === cardCategory
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
          )
        })}
      </div>

      <Panel className="space-y-4">
        <div className="flex justify-center">
          <div className="inline-flex rounded-full border border-cyan-200/35 bg-[#0c1430]/80 p-1">
            <button type="button" onClick={() => setMode('entree')} className={`inline-flex min-w-[170px] items-center justify-center gap-2 rounded-full px-6 py-2 text-xl font-semibold transition ${mode === 'entree' ? 'bg-gradient-to-r from-cyan-500/45 to-blue-500/40 text-cyan-50 shadow-[0_0_30px_rgba(56,189,248,0.45)]' : 'text-white/70 hover:text-white'}`}>
              <ArrowDown className="h-5 w-5" />
              {modeLeftLabel}
            </button>
            <button type="button" onClick={() => setMode('sortie')} className={`inline-flex min-w-[170px] items-center justify-center gap-2 rounded-full px-6 py-2 text-xl font-semibold transition ${mode === 'sortie' ? 'bg-gradient-to-r from-cyan-500/45 to-blue-500/40 text-cyan-50 shadow-[0_0_30px_rgba(56,189,248,0.45)]' : 'text-white/70 hover:text-white'}`}>
              <ArrowUp className="h-5 w-5" />
              {modeRightLabel}
            </button>
          </div>
        </div>

        <div className={`grid gap-3 ${isTradeVariant ? 'xl:grid-cols-[1fr_1fr_auto_auto_auto_auto]' : 'xl:grid-cols-[1fr_1fr_auto_auto_auto]'}`}>
          <Input value={counterparty} onChange={(event) => setCounterparty(event.target.value)} placeholder="Interlocuteur" className="h-11" />
          <Input value={member} onChange={(event) => setMember(event.target.value)} placeholder="Membre" className="h-11" />
          <div className="inline-flex h-11 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-500/10 px-5 text-sm font-semibold text-cyan-100">Total : <span className="ml-1 inline-block min-w-[1.5ch] text-right">{safeTotalItems}</span></div>
          {isTradeVariant ? <div className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-5 text-sm font-semibold text-emerald-100">Total: {totalAmount.toFixed(2)} $</div> : null}
          <SecondaryButton onClick={clearTransaction} className="h-11 px-6">Annuler</SecondaryButton>
          <PrimaryButton onClick={() => void submitTransaction()} disabled={isSubmitting} className="h-11 px-6">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Valider</PrimaryButton>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel className="xl:col-span-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un objet" className="h-10 pl-9" />
            </div>
            <GlassSelect value={type} onChange={(event) => setType(event.target.value as UnifiedTypeFilterValue)} options={getTypeFilterOptions(category)} className="h-10 min-w-[180px]" />
          </div>

          <div className="mt-3 space-y-2 max-h-[44vh] overflow-y-auto pr-1">
            {isLoading ? <p className="py-8 text-center text-sm text-white/55">Chargement...</p> : null}
            {!isLoading && filteredItems.length === 0 ? <p className="py-8 text-center text-sm text-white/55">Aucun objet trouvé.</p> : null}
            {filteredItems.map((item) => {
              const normalizedCategory = normalizeCatalogCategory(item.category) || 'custom'
              const CategoryIcon =
                normalizedCategory === 'objects' ? Box
                  : normalizedCategory === 'weapons' ? Swords
                    : normalizedCategory === 'equipment' ? Shield
                      : normalizedCategory === 'drugs' ? Pill
                        : Shapes
              return (
                <button key={item.id} type="button" onClick={() => addItem(item)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-cyan-300/35 hover:bg-cyan-500/[0.06]">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.08]">
                      {item.image_url ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" /> : <CategoryIcon className="h-5 w-5 text-white/70" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                      <p className="text-xs text-white/60">Stock: {Math.max(0, Number(item.stock || 0))}{isTradeVariant ? ` · Achat: ${Math.max(0, Number(item.buy_price || item.internal_value || item.sell_price || 0)).toFixed(2)} $ · Vente: ${Math.max(0, Number(item.sell_price || item.internal_value || item.buy_price || 0)).toFixed(2)} $` : ''}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </Panel>

        <Panel className="flex h-full max-h-[44vh] flex-col xl:col-span-2">
          <h2 className="text-xl font-semibold text-white">Objets sélectionnés</h2>
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
            {selectedItems.length === 0 ? <p className="py-8 text-center text-sm text-white/55">Aucun objet sélectionné.</p> : null}
            {selectedItems.map((entry) => {
              const ItemIcon =
                entry.category === 'objects' ? Box
                  : entry.category === 'weapons' ? Swords
                    : entry.category === 'equipment' ? Shield
                      : entry.category === 'drugs' ? Pill
                        : Shapes
              return (
                <div key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.08]">
                        {entry.imageUrl ? <img src={entry.imageUrl} alt={entry.name} className="h-full w-full object-cover" loading="lazy" /> : <ItemIcon className="h-5 w-5 text-white/70" />}
                      </div>
                      <p className="truncate text-sm font-semibold text-white">{entry.name}</p>
                    </div>
                    <button type="button" onClick={() => removeItem(entry.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300/35 bg-rose-500/15 text-rose-100"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-white/15 bg-white/[0.04]">
                      <button type="button" onClick={() => updateQuantity(entry.id, entry.quantity - 1)} className="inline-flex h-full w-9 items-center justify-center border-r border-white/10 text-white/90"><Minus className="h-4 w-4" /></button>
                      <Input value={entry.quantity} onChange={(event) => updateQuantity(entry.id, Number(event.target.value))} inputMode="numeric" className="h-full w-16 rounded-none border-0 bg-transparent px-2 text-center text-sm" />
                      <button type="button" onClick={() => updateQuantity(entry.id, entry.quantity + 1)} className="inline-flex h-full w-9 items-center justify-center border-l border-white/10 text-white/90"><Plus className="h-4 w-4" /></button>
                    </div>
                    {isTradeVariant ? (
                      <div className="ml-2 flex items-center gap-2">
                        <span className="text-[11px] text-white/60">A: {(entry.buyPrice ?? 0).toFixed(2)}$ · V: {(entry.sellPrice ?? 0).toFixed(2)}$</span>
                        <span className="text-xs text-white/65">PU</span>
                        <Input value={entry.price} onChange={(event) => updatePrice(entry.id, Number(event.target.value))} inputMode="decimal" className="h-9 w-24 text-right text-sm" />
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}
