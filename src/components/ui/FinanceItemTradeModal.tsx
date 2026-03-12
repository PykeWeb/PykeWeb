'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Box, Image as ImageIcon, Pill, Search, Shapes, Shield, Swords } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { DangerButton, PrimaryButton, SecondaryButton, TabPill } from '@/components/ui/design-system'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { CenteredFormLayout } from '@/components/ui/CenteredFormLayout'
import { listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem, ItemCategory, ItemType } from '@/lib/types/itemsFinance'
import { calcTotal, toNonNegative, toPositiveInt } from '@/lib/numberUtils'
import { copy } from '@/lib/copy'
import { categoryTypeOptions, getTypeLabel } from '@/lib/catalogConfig'
import { useUiThemeConfig } from '@/hooks/useUiThemeConfig'

type CategoryFilter = 'all' | ItemCategory
type TypeFilter = 'all' | ItemType

type TradeLine = {
  itemId: string
  quantity: number
  unitPrice: string
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }
  return fallback
}

export function FinanceItemTradeModal({
  open,
  mode,
  onClose,
  onSubmit,
  enableModeSelect = false,
  inline = false,
  initialItems = [],
  hideTitle = false,
  hideUnitPrice = false,
  titleOverride,
  subtitleOverride,
  showModeBadge = true,
  modeBuyLabel,
  modeSellLabel,
}: {
  open: boolean
  mode: 'buy' | 'sell'
  onClose: () => void
  onSubmit: (payload: { item: CatalogItem; mode: 'buy' | 'sell'; quantity: number; unitPrice: number; counterparty: string; notes: string }) => Promise<void>
  enableModeSelect?: boolean
  inline?: boolean
  initialItems?: CatalogItem[]
  hideTitle?: boolean
  hideUnitPrice?: boolean
  titleOverride?: string
  subtitleOverride?: string
  showModeBadge?: boolean
  modeBuyLabel?: string
  modeSellLabel?: string
}) {
  const themeConfig = useUiThemeConfig()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>(mode)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [itemSearch, setItemSearch] = useState('')
  const [lines, setLines] = useState<TradeLine[]>([])
  const [counterparty, setCounterparty] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingItems, setLoadingItems] = useState(false)

  const buyModeLabel = modeBuyLabel || copy.finance.trade.modeBuy
  const sellModeLabel = modeSellLabel || copy.finance.trade.modeSell

  useEffect(() => {
    setTradeMode(mode)
  }, [mode])

  useEffect(() => {
    if (!open) return

    setItems(initialItems)
    setLines([])
    setNotes('')
    setLoadingItems(true)

    ;(async () => {
      const rows = await listCatalogItemsUnified()
      setItems(rows)
    })()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : copy.finance.errors.loadItemsFailed))
      .finally(() => setLoadingItems(false))
  }, [open, initialItems])

  const typeOptions = useMemo(() => {
    if (category === 'all') {
      const values = Array.from(new Set(items.map((it) => it.item_type)))
      return [{ value: 'all', label: copy.common.allTypes }, ...values.map((value) => ({ value, label: getTypeLabel(value) }))]
    }
    return [{ value: 'all', label: copy.common.allTypes }, ...categoryTypeOptions[category]]
  }, [category, items])

  const filtered = useMemo(() => {
    const search = itemSearch.trim().toLowerCase()
    return items
      .filter((it) => (hideUnitPrice && tradeMode === 'sell' ? Math.max(0, Number(it.stock) || 0) > 0 : true))
      .filter((it) => (category === 'all' ? true : it.category === category))
      .filter((it) => (type === 'all' ? true : it.item_type === type))
      .filter((it) => {
        if (!search) return true
        return `${it.name} ${it.internal_id}`.toLowerCase().includes(search)
      })
  }, [items, category, type, itemSearch, hideUnitPrice, tradeMode])

  const linesWithItems = useMemo(() => {
    return lines
      .map((line) => {
        const item = items.find((entry) => entry.id === line.itemId)
        if (!item) return null
        const qty = toPositiveInt(line.quantity)
        const unit = toNonNegative(line.unitPrice)
        return { line, item, qty, unit, subtotal: calcTotal(qty, unit) }
      })
      .filter((entry): entry is { line: TradeLine; item: CatalogItem; qty: number; unit: number; subtotal: number } => !!entry)
  }, [items, lines])

  useEffect(() => {
    setLines((current) =>
      current.map((line) => {
        const item = items.find((entry) => entry.id === line.itemId)
        if (!item) return line
        const quantity = tradeMode === 'sell' ? Math.min(toPositiveInt(line.quantity), Math.max(1, item.stock)) : toPositiveInt(line.quantity)
        const nextUnit = hideUnitPrice ? 0 : (tradeMode === 'buy' ? item.buy_price : item.sell_price)
        return { ...line, quantity, unitPrice: String(toNonNegative(nextUnit)) }
      })
    )
  }, [items, tradeMode, hideUnitPrice])

  const total = useMemo(() => linesWithItems.reduce((sum, entry) => sum + entry.subtotal, 0), [linesWithItems])

  function addItemToLines(item: CatalogItem) {
    setLines((current) => {
      const exists = current.find((line) => line.itemId === item.id)
      if (exists) {
        return current.map((line) => (line.itemId === item.id ? { ...line, quantity: line.quantity + 1 } : line))
      }
      const defaultPrice = hideUnitPrice ? 0 : (tradeMode === 'buy' ? item.buy_price : item.sell_price)
      return [...current, { itemId: item.id, quantity: 1, unitPrice: String(defaultPrice) }]
    })
  }

  function updateLine(itemId: string, patch: Partial<TradeLine>) {
    setLines((current) => current.map((line) => (line.itemId === itemId ? { ...line, ...patch } : line)))
  }

  function removeLine(itemId: string) {
    setLines((current) => current.filter((line) => line.itemId !== itemId))
  }

  if (!open) return null

  const content = (
    <div
      className={inline ? 'mx-auto w-full max-w-6xl h-[calc(100dvh-12.5rem)]' : 'mx-auto w-full max-w-6xl max-h-[calc(100dvh-1.25rem)] overflow-y-auto pr-1 overscroll-contain'}
      onClick={(e) => e.stopPropagation()}
    >
      <CenteredFormLayout
        panelClassName={inline ? 'h-full overflow-hidden border-slate-700 bg-slate-900 shadow-[0_20px_45px_rgba(0,0,0,0.45)]' : 'border-slate-700 bg-slate-900 shadow-[0_20px_45px_rgba(0,0,0,0.45)]'}
        title={hideTitle ? undefined : (titleOverride || copy.finance.trade.title)}
        subtitle={subtitleOverride}
        actions={
          <>
            <SecondaryButton onClick={onClose}>Fermer</SecondaryButton>
            <PrimaryButton
              disabled={saving || linesWithItems.length === 0}
              onClick={async () => {
                try {
                  setSaving(true)
                  setError(null)
                  for (const entry of linesWithItems) {
                    await onSubmit({
                      item: entry.item,
                      mode: tradeMode,
                      quantity: entry.qty,
                      unitPrice: entry.unit,
                      counterparty,
                      notes,
                    })
                  }
                  onClose()
                } catch (e: unknown) {
                  setError(toErrorMessage(e, copy.finance.errors.saveFailed))
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? copy.finance.trade.saveInProgress : copy.finance.actions.validate}
            </PrimaryButton>
          </>
        }
        actionsPlacement="top-right"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            {enableModeSelect ? (
              <div className="flex flex-wrap items-center gap-2">
                <TabPill className="h-9 rounded-xl px-3 text-xs data-[active=true]:border-emerald-300/60 data-[active=true]:bg-emerald-500/25 data-[active=true]:text-emerald-50" active={tradeMode === 'buy'} onClick={() => setTradeMode('buy')}>
                  <ArrowDownRight className="h-4 w-4" />
                  {buyModeLabel}
                </TabPill>
                <TabPill className="h-9 rounded-xl px-3 text-xs data-[active=true]:border-rose-300/60 data-[active=true]:bg-rose-500/25 data-[active=true]:text-rose-50" active={tradeMode === 'sell'} onClick={() => setTradeMode('sell')}>
                  <ArrowUpRight className="h-4 w-4" />
                  {sellModeLabel}
                </TabPill>
              </div>
            ) : showModeBadge ? (
              <div className="inline-flex rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs text-white/70">
                {tradeMode === 'buy' ? buyModeLabel : sellModeLabel}
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.counterparty}</label>
            <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Nom / société / membre" />
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/60">Raison / note</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pourquoi cette opération ?" />
          </div>

          <div className="md:col-span-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { key: 'all', label: copy.common.allCategories, icon: Shapes },
              { key: 'objects', label: 'Objets', icon: Box },
              { key: 'weapons', label: 'Armes', icon: Swords },
              { key: 'equipment', label: 'Équipement', icon: Shield },
              { key: 'drugs', label: 'Drogues', icon: Pill },
              { key: 'custom', label: 'Autres\u200b', icon: Shapes },
            ].map((option) => {
              const cardQty = items.reduce((total, item) => {
                if (option.key !== 'all' && item.category !== option.key) return total
                return total + Math.max(0, Number(item.stock) || 0)
              }, 0)
              const Icon = option.icon
              const bubbleKey = `finance.trade.category.${option.key}`
              const bubble = themeConfig.bubbles[bubbleKey]
              return (
                <button
                  key={option.key}
                  type="button"
                  data-bubble-key={bubbleKey}
                  onClick={() => {
                    setCategory(option.key as CategoryFilter)
                    setType('all')
                  }}
                  style={{
                    background: bubble?.bgColor || undefined,
                    borderColor: bubble?.borderColor || undefined,
                    color: bubble?.textColor || undefined,
                    minWidth: bubble?.minWidthPx ? `${bubble.minWidthPx}px` : undefined,
                    minHeight: bubble?.minHeightPx ? `${bubble.minHeightPx}px` : undefined,
                  }}
                  className={`rounded-xl border px-2.5 py-2.5 text-left transition min-h-[82px] ${
                    category === option.key
                      ? option.key === 'objects'
                        ? 'border-cyan-200/75 bg-gradient-to-br from-cyan-500/35 to-blue-500/25'
                        : option.key === 'weapons'
                          ? 'border-rose-200/75 bg-gradient-to-br from-rose-500/35 to-orange-500/25'
                          : option.key === 'equipment'
                            ? 'border-violet-200/75 bg-gradient-to-br from-violet-500/35 to-fuchsia-500/25'
                            : option.key === 'drugs'
                              ? 'border-emerald-200/75 bg-gradient-to-br from-emerald-500/35 to-teal-500/25'
                              : option.key === 'custom'
                                ? 'border-amber-200/75 bg-gradient-to-br from-amber-500/35 to-orange-500/25'
                                : 'border-slate-200/70 bg-gradient-to-br from-slate-500/30 to-slate-700/22'
                      : option.key === 'objects'
                        ? 'border-cyan-300/25 bg-cyan-500/[0.07] hover:bg-cyan-500/[0.14]'
                        : option.key === 'weapons'
                          ? 'border-rose-300/25 bg-rose-500/[0.07] hover:bg-rose-500/[0.14]'
                          : option.key === 'equipment'
                            ? 'border-violet-300/25 bg-violet-500/[0.07] hover:bg-violet-500/[0.14]'
                            : option.key === 'drugs'
                              ? 'border-emerald-300/25 bg-emerald-500/[0.07] hover:bg-emerald-500/[0.14]'
                              : option.key === 'custom'
                                ? 'border-amber-300/25 bg-amber-500/[0.07] hover:bg-amber-500/[0.14]'
                                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] text-white/70">{option.label}</p>
                    <span className="rounded-md border border-white/10 bg-white/[0.06] p-1 text-white/80">
                      <Icon className="h-3 w-3" />
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-semibold leading-none">
                    {cardQty}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="md:col-span-3 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {typeOptions.map((option) => (
                <TabPill key={option.value} active={type === option.value} onClick={() => setType(option.value as TypeFilter)} className="h-8 rounded-xl px-3 text-xs">
                  {option.label}
                </TabPill>
              ))}
            </div>
            <div className="ml-auto inline-flex h-8 items-center rounded-xl border border-white/20 bg-white/[0.05] px-3 text-right text-xs">
              <span className="text-sm font-semibold text-white">{`${copy.finance.labels.total} : ${total.toFixed(2)} $`}</span>
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
              <div className="rounded-2xl p-0">
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <Search className="h-4 w-4 text-white/50" />
                  <input
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    placeholder="Rechercher un item"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-white/45"
                  />
                </div>
                <div className="h-[clamp(19rem,50dvh,30rem)] space-y-1 overflow-y-auto pr-1">
                  {loadingItems ? <p className="px-2 py-2 text-xs text-white/60">Chargement des items…</p> : null}
                  {filtered.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => addItemToLines(it)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition hover:bg-white/[0.06]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                          {it.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-white/40">
                              <ImageIcon className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{it.name}</p>
                          <p className="truncate text-xs text-white/60">{getTypeLabel(it.item_type, it.category)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-xs text-white/65">Stock: {it.stock}</span>
                        {hideUnitPrice ? null : <span className="text-xs text-white/65">Prix {tradeMode === 'buy' ? 'achat' : 'vente'}: {(tradeMode === 'buy' ? it.buy_price : it.sell_price).toFixed(2)} $</span>}
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 ? <p className="px-2 py-2 text-xs text-white/60">Aucun item pour ces filtres.</p> : null}
                </div>
              </div>

              <div className="hidden rounded-xl border border-white/10 bg-white/[0.02] p-2 lg:block">
                {linesWithItems.length === 0 ? <p className="px-1 py-2 text-sm text-white/60">Ajoute des items pour voir la liste.</p> : null}
                <div className="h-[clamp(19rem,50dvh,30rem)] space-y-2 overflow-y-auto pr-1">
                  {linesWithItems.map((entry) => (
                    <div key={`preview-${entry.item.id}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-[11px]">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
                          {entry.item.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={entry.item.image_url} alt={entry.item.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-white/40">
                              <ImageIcon className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-white">{entry.item.name}</p>
                          <p className="truncate text-[10px] text-white/65">{getTypeLabel(entry.item.item_type, entry.item.category)}</p>
                        </div>
                        <DangerButton
                          type="button"
                          className="h-7 rounded-md px-2 text-[10px]"
                          onClick={() => removeLine(entry.item.id)}
                        >
                          Retirer
                        </DangerButton>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <QuantityStepper
                          size="sm"
                          fitContent
                          value={entry.line.quantity}
                          onChange={(value) => updateLine(entry.item.id, { quantity: value })}
                          min={1}
                          max={tradeMode === 'sell' ? Math.max(1, entry.item.stock) : undefined}
                        />

                        {hideUnitPrice ? (
                          <p className="text-[11px] text-white/60">Sortie stock</p>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Input
                              value={entry.line.unitPrice}
                              onChange={(e) => updateLine(entry.item.id, { unitPrice: e.target.value })}
                              inputMode="decimal"
                              style={{ width: `${Math.max(8, entry.line.unitPrice.trim().length + 3)}ch` }}
                              className="h-7 px-2 text-center text-sm"
                            />
                            <span className="text-sm font-semibold text-white/85">$</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}
      </CenteredFormLayout>
    </div>
  )

  if (inline) return <div className="mt-0">{content}</div>

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950 p-4" onClick={onClose}>
      {content}
    </div>
  )
}
