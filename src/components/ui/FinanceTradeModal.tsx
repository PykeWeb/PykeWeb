'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { listGlobalCatalogItems, type CatalogCategory } from '@/lib/catalogApi'

export type TradeItem = {
  id: string
  source_id: string
  category: CatalogCategory
  item_type: string | null
  name: string
  price: number
  stock: number
}

export function FinanceTradeModal({
  open,
  mode,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'buy' | 'sell'
  onClose: () => void
  onSubmit: (args: { item: TradeItem; quantity: number; unitPrice: number }) => Promise<void>
}) {
  const [items, setItems] = useState<TradeItem[]>([])
  const [category, setCategory] = useState<CatalogCategory>('objects')
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [price, setPrice] = useState('0')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    ;(async () => {
      const data = await listGlobalCatalogItems()
      setItems(data as TradeItem[])
      if (data.length) {
        const first = data[0]
        setCategory(first.category)
      }
    })().catch(() => setItems([]))
  }, [open])

  const filtered = useMemo(() => items.filter((it) => it.category === category), [items, category])

  useEffect(() => {
    const first = filtered[0]
    if (!first) return
    setItemId(first.id)
  }, [filtered])

  const selected = useMemo(() => filtered.find((it) => it.id === itemId) || null, [filtered, itemId])

  useEffect(() => {
    if (selected) setPrice(String(selected.price ?? 0))
  }, [selected])

  const unitPrice = Math.max(0, Number(price || 0) || 0)
  const total = unitPrice * quantity

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-slate-950/90 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-semibold">{mode === 'buy' ? 'Acheter' : 'Vendre / Sortie'}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs text-white/60">Catégorie</p>
            <GlassSelect
              className="mt-1"
              value={category}
              onChange={(v) => setCategory(v as CatalogCategory)}
              options={[
                { value: 'objects', label: 'Objets' },
                { value: 'weapons', label: 'Armes' },
                { value: 'equipment', label: 'Équipement' },
                { value: 'drugs', label: 'Drogues' },
              ]}
            />
          </div>
          <div>
            <p className="text-xs text-white/60">Item</p>
            <GlassSelect className="mt-1" value={itemId} onChange={setItemId} options={filtered.map((it) => ({ value: it.id, label: it.name }))} />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/75">
          Type: <span className="font-semibold text-white">{selected?.item_type || '—'}</span> • Stock: <span className="font-semibold text-white">{selected?.stock ?? 0}</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs text-white/60">Quantité</p>
            <div className="mt-1 flex items-center gap-2">
              <SecondaryButton type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} icon={<Minus className="h-4 w-4" />} />
              <input className="h-10 w-24 rounded-2xl border border-white/12 bg-white/[0.06] px-3" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))} />
              <SecondaryButton type="button" onClick={() => setQuantity((q) => q + 1)} icon={<Plus className="h-4 w-4" />} />
              {[5, 10, 25, 50].map((preset) => (
                <button key={preset} className="rounded-xl border border-white/15 bg-white/[0.05] px-2 py-1 text-xs" onClick={() => setQuantity(preset)}>
                  {preset}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-white/60">Prix unitaire (override)</p>
            <input className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-right text-sm">
          Total: <span className="text-lg font-semibold text-cyan-100">{total.toFixed(2)} $</span>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Annuler</SecondaryButton>
          <PrimaryButton
            disabled={loading || !selected || (mode === 'sell' && quantity > (selected.stock ?? 0))}
            onClick={async () => {
              if (!selected) return
              setLoading(true)
              try {
                await onSubmit({ item: selected, quantity, unitPrice })
                onClose()
              } finally {
                setLoading(false)
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
