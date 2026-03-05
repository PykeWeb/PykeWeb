'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Image as ImageIcon, Search } from 'lucide-react'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PrimaryButton, SecondaryButton, TabPill } from '@/components/ui/design-system'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { CenteredFormLayout } from '@/components/ui/CenteredFormLayout'
import { listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem, ItemCategory, ItemType } from '@/lib/types/itemsFinance'
import { calcTotal, toNonNegative, toPositiveInt } from '@/lib/numberUtils'
import { copy } from '@/lib/copy'
import { categoryTypeOptions, getTypeLabel, itemCategoryOptions } from '@/lib/catalogConfig'

type CategoryFilter = 'all' | ItemCategory
type TypeFilter = 'all' | ItemType

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
}: {
  open: boolean
  mode: 'buy' | 'sell'
  onClose: () => void
  onSubmit: (payload: { item: CatalogItem; mode: 'buy' | 'sell'; quantity: number; unitPrice: number; counterparty: string; notes: string }) => Promise<void>
  enableModeSelect?: boolean
  inline?: boolean
}) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>(mode)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [itemId, setItemId] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('0')
  const [counterparty, setCounterparty] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTradeMode(mode)
  }, [mode])

  useEffect(() => {
    if (!open) return
    ;(async () => {
      const rows = await listCatalogItemsUnified()
      setItems(rows)
      const first = rows[0]
      if (first) setItemId(first.id)
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : copy.finance.errors.loadItemsFailed))
  }, [open])

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
      .filter((it) => (category === 'all' ? true : it.category === category))
      .filter((it) => (type === 'all' ? true : it.item_type === type))
      .filter((it) => {
        if (!search) return true
        return `${it.name} ${it.internal_id}`.toLowerCase().includes(search)
      })
  }, [items, category, type, itemSearch])

  useEffect(() => {
    if (!filtered.find((x) => x.id === itemId)) setItemId(filtered[0]?.id || '')
  }, [filtered, itemId])

  const selected = useMemo(() => filtered.find((x) => x.id === itemId) || null, [filtered, itemId])

  useEffect(() => {
    if (!selected) return
    setUnitPrice(String(tradeMode === 'buy' ? selected.buy_price : selected.sell_price))
    setQuantity(1)
  }, [selected, tradeMode])

  const computedQuantityRaw = toPositiveInt(quantity)
  const maxForSell = selected?.stock ?? 0
  const computedQuantity = tradeMode === 'sell' ? Math.min(computedQuantityRaw, Math.max(1, maxForSell)) : computedQuantityRaw
  const computedUnitPrice = toNonNegative(unitPrice)
  const total = calcTotal(computedQuantity, computedUnitPrice)

  if (!open) return null

  const content = (
    <div className="mx-auto w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
      <CenteredFormLayout
          title={copy.finance.trade.title}
          subtitle={copy.finance.trade.subtitle}
          actions={
            <>
              <SecondaryButton onClick={onClose}>{copy.common.cancel}</SecondaryButton>
              <PrimaryButton
                disabled={saving || !selected || (tradeMode === 'sell' && computedQuantity > (selected.stock || 0))}
                onClick={async () => {
                  if (!selected) return
                  try {
                    setSaving(true)
                    setError(null)
                    await onSubmit({ item: selected, mode: tradeMode, quantity: computedQuantity, unitPrice: computedUnitPrice, counterparty, notes })
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
          actionsPlacement="bottom-right"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-white/50">Informations</div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Mode</label>
              {enableModeSelect ? (
                <div className="flex flex-wrap gap-2">
                  <TabPill active={tradeMode === 'buy'} onClick={() => setTradeMode('buy')}>
                    <ArrowDownRight className="h-4 w-4" />
                    {copy.finance.trade.modeBuy}
                  </TabPill>
                  <TabPill active={tradeMode === 'sell'} onClick={() => setTradeMode('sell')}>
                    <ArrowUpRight className="h-4 w-4" />
                    {copy.finance.trade.modeSell}
                  </TabPill>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80">{tradeMode === 'buy' ? copy.finance.trade.modeBuy : copy.finance.trade.modeSell}</div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.category}</label>
              <GlassSelect value={category} onChange={(v) => setCategory(v as CategoryFilter)} options={[{ value: 'all', label: copy.common.allCategories }, ...itemCategoryOptions]} />
            </div>

            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.finance.trade.typeOptional}</label>
              <GlassSelect value={type} onChange={(v) => setType(v as TypeFilter)} options={typeOptions} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.item}</label>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2">
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <Search className="h-4 w-4 text-white/50" />
                  <input
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    placeholder="Rechercher un item"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-white/45"
                  />
                </div>
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                  {filtered.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setItemId(it.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${itemId === it.id ? 'border-cyan-300/40 bg-cyan-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{it.name}</p>
                        <p className="truncate text-xs text-white/60">{getTypeLabel(it.item_type, it.category)} · Stock: {it.stock}</p>
                      </div>
                      <div className="ml-3 h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                        {it.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-3.5 w-3.5" /></div>
                        )}
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 ? <p className="px-2 py-2 text-xs text-white/60">Aucun item pour ces filtres.</p> : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/75 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-white/55">{copy.finance.trade.selectedItem}</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                  {selected?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.image_url} alt={selected.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-4 w-4" /></div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-white">{selected?.name || copy.finance.trade.noItem}</div>
                  <div>
                    Type: <span className="text-white">{selected ? getTypeLabel(selected.item_type, selected.category) : '—'}</span> · {copy.finance.trade.stockNow}: <span className="text-white">{selected?.stock ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-white/50">Prix & stock</div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.quantity}</label>
              <div className="max-w-[260px]"><QuantityStepper value={quantity} onChange={setQuantity} min={1} max={tradeMode === 'sell' ? Math.max(1, selected?.stock ?? 0) : undefined} /></div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.unitPrice}</label>
              <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.counterparty}</label>
              <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Nom / société / membre" />
            </div>
            <div className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-white/50">Notes</div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.notes}</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[96px]" />
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-3 text-right text-sm">{copy.finance.labels.total}: <span className="text-lg font-semibold text-cyan-100">{total.toFixed(2)} $</span></div>
          {error ? <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      </CenteredFormLayout>
    </div>
  )

  if (inline) return <div className="mt-6">{content}</div>

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      {content}
    </div>
  )
}
