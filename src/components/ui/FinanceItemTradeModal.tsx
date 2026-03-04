'use client'

import { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { CenteredFormLayout } from '@/components/ui/CenteredFormLayout'
import { listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem, FinancePaymentMode, ItemCategory, ItemType } from '@/lib/types/itemsFinance'
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
}: {
  open: boolean
  mode: 'buy' | 'sell'
  onClose: () => void
  onSubmit: (payload: { item: CatalogItem; mode: 'buy' | 'sell'; quantity: number; unitPrice: number; counterparty: string; notes: string; payment_mode: FinancePaymentMode }) => Promise<void>
  enableModeSelect?: boolean
}) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>(mode)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [step, setStep] = useState(1)
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('0')
  const [counterparty, setCounterparty] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMode, setPaymentMode] = useState<FinancePaymentMode>('cash')
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
      return [{ value: 'all', label: 'Tous les types' }, ...values.map((value) => ({ value, label: getTypeLabel(value) }))]
    }
    return [{ value: 'all', label: 'Tous les types' }, ...categoryTypeOptions[category]]
  }, [category, items])

  const filtered = useMemo(
    () => items.filter((it) => (category === 'all' ? true : it.category === category)).filter((it) => (type === 'all' ? true : it.item_type === type)),
    [items, category, type]
  )

  useEffect(() => {
    if (!filtered.find((x) => x.id === itemId)) setItemId(filtered[0]?.id || '')
  }, [filtered, itemId])

  const selected = useMemo(() => filtered.find((x) => x.id === itemId) || null, [filtered, itemId])

  useEffect(() => {
    if (!selected) return
    setUnitPrice(String(tradeMode === 'buy' ? selected.buy_price : selected.sell_price))
    setQuantity(1)
    setStep(1)
  }, [selected, tradeMode])

  const computedQuantityRaw = toPositiveInt(quantity)
  const maxForSell = selected?.stock ?? 0
  const computedQuantity = tradeMode === 'sell' ? Math.min(computedQuantityRaw, Math.max(1, maxForSell)) : computedQuantityRaw
  const computedUnitPrice = toNonNegative(unitPrice)
  const total = calcTotal(computedQuantity, computedUnitPrice)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
        <CenteredFormLayout
          title="Achat / Vente"
          subtitle="Formulaire unifié"
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
                    await onSubmit({ item: selected, mode: tradeMode, quantity: computedQuantity, unitPrice: computedUnitPrice, counterparty, notes, payment_mode: paymentMode })
                    onClose()
                  } catch (e: unknown) {
                    setError(toErrorMessage(e, copy.finance.errors.saveFailed))
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                {copy.finance.actions.validate}
              </PrimaryButton>
            </>
          }
          actionsPlacement="bottom-right"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {enableModeSelect ? (
              <div>
                <label className="mb-1 block text-xs text-white/60">Mode</label>
                <GlassSelect value={tradeMode} onChange={(v) => setTradeMode(v as 'buy' | 'sell')} options={[{ value: 'buy', label: 'Achat' }, { value: 'sell', label: 'Vente' }]} />
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.category}</label>
              <GlassSelect value={category} onChange={(v) => setCategory(v as CategoryFilter)} options={[{ value: 'all', label: 'Toutes' }, ...itemCategoryOptions]} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Type (optionnel)</label>
              <GlassSelect value={type} onChange={(v) => setType(v as TypeFilter)} options={typeOptions} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.item}</label>
              <GlassSelect value={itemId} onChange={setItemId} options={filtered.map((it) => ({ value: it.id, label: it.name }))} />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/75 md:col-span-2">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                  {selected?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.image_url} alt={selected.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-4 w-4" /></div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-white">{selected?.name || '—'}</div>
                  <div>Type: <span className="text-white">{selected ? getTypeLabel(selected.item_type, selected.category) : '—'}</span> · Stock actuel: <span className="text-white">{selected?.stock ?? 0}</span></div>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.quantity}</label>
              <QuantityStepper value={quantity} onChange={setQuantity} min={1} max={tradeMode === 'sell' ? Math.max(1, selected?.stock ?? 0) : undefined} />
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 5, 10].map((nextStep) => (
                  <button key={nextStep} type="button" onClick={() => setStep(nextStep)} className={`h-8 rounded-xl border px-3 text-xs ${step === nextStep ? 'border-white/30 bg-white/15' : 'border-white/12 bg-white/[0.06]'}`}>
                    Step {nextStep}
                  </button>
                ))}
                {[5, 10, 25, 50].map((preset) => (
                  <button key={preset} type="button" onClick={() => setQuantity(Math.max(1, preset))} className="h-8 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">
                    {preset}
                  </button>
                ))}
                <button type="button" onClick={() => setQuantity((prev) => Math.max(1, prev + step))} className="h-8 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">
                  +{step}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.unitPrice}</label>
              <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.counterparty}</label>
              <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Nom / société / membre" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.paymentMode}</label>
              <GlassSelect value={paymentMode} onChange={(v) => setPaymentMode(v as FinancePaymentMode)} options={[{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank' }, { value: 'item', label: 'Item' }, { value: 'other', label: 'Autre' }]} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-white/60">{copy.finance.labels.notes}</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[90px]" />
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-3 text-right text-sm">{copy.finance.labels.total}: <span className="text-lg font-semibold text-cyan-100">{total.toFixed(2)} $</span></div>
          {error ? <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
        </CenteredFormLayout>
      </div>
    </div>
  )
}
