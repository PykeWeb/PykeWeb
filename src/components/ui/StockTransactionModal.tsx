'use client'

import { Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'

function money(v: number) {
  return `${v.toFixed(2)} $`
}

export function StockTransactionModal({
  open,
  kind,
  title,
  stock,
  unitPrice,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean
  kind: 'purchase' | 'sale'
  title: string
  stock: number
  unitPrice?: number | null
  loading?: boolean
  onClose: () => void
  onSubmit: (quantity: number) => Promise<void>
}) {
  const [quantity, setQuantity] = useState(1)
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const total = useMemo(() => (unitPrice ?? 0) * quantity, [unitPrice, quantity])

  if (!open) return null

  const applyDelta = (delta: number) => {
    const next = Math.max(1, quantity + delta)
    setQuantity(next)
    setError(null)
  }

  const submit = async () => {
    if (quantity < 1) {
      setError('La quantité minimale est 1.')
      return
    }
    if (kind === 'sale' && quantity > stock) {
      setError(`Stock insuffisant (stock actuel: ${stock}).`)
      return
    }

    setError(null)
    await onSubmit(quantity)
    setQuantity(1)
    setStep(1)
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/12 bg-[#0f1625]/95 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-semibold">{kind === 'purchase' ? 'Achat' : 'Sortie'} • {title}</h3>
        <p className="mt-1 text-sm text-white/65">Stock actuel: {stock}</p>

        <div className="mt-4 space-y-2">
          <p className="text-xs text-white/60">Quantité</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => applyDelta(-step)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] hover:bg-white/[0.12]">
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="h-10 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3 text-sm"
            />
            <button type="button" onClick={() => applyDelta(step)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06] hover:bg-white/[0.12]">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[1, 5, 10].map((s) => (
            <button key={s} onClick={() => setStep(s)} className={`h-8 rounded-xl border px-3 text-xs ${step === s ? 'border-white/30 bg-white/15' : 'border-white/12 bg-white/[0.06]'}`}>
              Step {s}
            </button>
          ))}
          {[5, 10, 25, 50].map((preset) => (
            <button key={preset} onClick={() => setQuantity(Math.max(1, preset))} className="h-8 rounded-xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">
              {preset}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm text-white/70">Total estimé: <span className="font-semibold text-white">{money(total)}</span></p>
        {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Annuler</SecondaryButton>
          <PrimaryButton disabled={loading} onClick={() => void submit()}>{loading ? 'Traitement…' : 'Valider'}</PrimaryButton>
        </div>
      </div>
    </div>
  )
}
