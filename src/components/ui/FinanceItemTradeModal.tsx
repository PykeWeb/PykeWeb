'use client'

import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { listCatalogItems } from '@/lib/itemsApi'
import type { CatalogItem, FinancePaymentMode, ItemCategory } from '@/lib/types/itemsFinance'

export function FinanceItemTradeModal({
  open,
  mode,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'buy' | 'sell'
  onClose: () => void
  onSubmit: (payload: { item: CatalogItem; quantity: number; unitPrice: number; counterparty: string; notes: string; payment_mode: FinancePaymentMode }) => Promise<void>
}) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [category, setCategory] = useState<'all' | ItemCategory>('all')
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('0')
  const [counterparty, setCounterparty] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMode, setPaymentMode] = useState<FinancePaymentMode>('cash')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    ;(async () => {
      const rows = await listCatalogItems()
      const visible = rows.filter((x) => x.is_active && x.show_in_finance)
      setItems(visible)
      const first = visible[0]
      if (first) setItemId(first.id)
    })().catch((e) => setError(e?.message || 'Impossible de charger les items'))
  }, [open])

  const filtered = useMemo(() => items.filter((it) => (category === 'all' ? true : it.category === category)), [items, category])
  const selected = useMemo(() => filtered.find((x) => x.id === itemId) || null, [filtered, itemId])

  useEffect(() => {
    if (!selected) return
    setUnitPrice(String(mode === 'buy' ? selected.buy_price : selected.sell_price))
  }, [selected, mode])

  const total = Math.max(0, Number(unitPrice || 0)) * quantity

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-3xl border border-white/15 bg-slate-950/95 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-semibold">{mode === 'buy' ? 'Achat' : 'Vente / Sortie'}</h3>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">Catégorie</label>
            <GlassSelect value={category} onChange={(v) => setCategory(v as any)} options={[{ value: 'all', label: 'Toutes' }, { value: 'objects', label: 'Objets' }, { value: 'weapons', label: 'Armes' }, { value: 'drugs', label: 'Drogues' }, { value: 'equipment', label: 'Équipements' }, { value: 'custom', label: 'Custom' }]} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Item *</label>
            <GlassSelect value={itemId} onChange={setItemId} options={filtered.map((it) => ({ value: it.id, label: it.name }))} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/75 md:col-span-2">
            Type: <span className="font-semibold text-white">{selected?.item_type || '—'}</span> · Stock: <span className="font-semibold text-white">{selected?.stock ?? 0}</span>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Quantité</label>
            <div className="flex items-center gap-2">
              <SecondaryButton type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} icon={<Minus className="h-4 w-4" />} />
              <Input value={String(quantity)} onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value || 1))))} className="w-24" inputMode="numeric" />
              <SecondaryButton type="button" onClick={() => setQuantity((q) => q + 1)} icon={<Plus className="h-4 w-4" />} />
              {[5, 10, 25, 50].map((n) => (
                <button key={n} type="button" className="rounded-xl border border-white/15 bg-white/[0.06] px-2 py-1 text-xs" onClick={() => setQuantity(n)}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Prix unitaire (override)</label>
            <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Interlocuteur</label>
            <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Nom / société / membre" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Mode de paiement</label>
            <GlassSelect value={paymentMode} onChange={(v) => setPaymentMode(v as FinancePaymentMode)} options={[{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank' }, { value: 'item', label: 'Item' }, { value: 'other', label: 'Autre' }]} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-white/60">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[90px]" />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-3 text-right text-sm">Total: <span className="text-lg font-semibold text-cyan-100">{total.toFixed(2)} $</span></div>
        {error ? <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

        <div className="mt-4 flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Annuler</SecondaryButton>
          <PrimaryButton
            disabled={saving || !selected || (mode === 'sell' && quantity > (selected.stock || 0))}
            onClick={async () => {
              if (!selected) return
              try {
                setSaving(true)
                setError(null)
                await onSubmit({ item: selected, quantity, unitPrice: Math.max(0, Number(unitPrice || 0)), counterparty, notes, payment_mode: paymentMode })
                onClose()
              } catch (e: any) {
                setError(e?.message || 'Impossible d’enregistrer la transaction.')
              } finally {
                setSaving(false)
              }
            }}
          >
            Valider
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
