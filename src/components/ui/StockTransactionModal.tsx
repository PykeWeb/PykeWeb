'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { CenteredFormLayout } from '@/components/ui/CenteredFormLayout'

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
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <CenteredFormLayout
          title={`${kind === 'purchase' ? 'Achat' : 'Sortie'} • ${title}`}
          subtitle={`Stock actuel: ${stock}`}
          actions={
            <>
              <SecondaryButton onClick={onClose}>Annuler</SecondaryButton>
              <PrimaryButton disabled={loading} onClick={() => void submit()}>{loading ? 'Traitement…' : 'Valider'}</PrimaryButton>
            </>
          }
          actionsPlacement="bottom-right"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-white/60">Quantité</label>
              <QuantityStepper value={quantity} onChange={setQuantity} min={1} max={kind === 'sale' ? Math.max(1, stock) : undefined} />
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
              <label className="mb-1 block text-xs text-white/60">Prix unitaire</label>
              <Input value={String(unitPrice ?? 0)} readOnly />
            </div>
          </div>

          <p className="mt-4 text-sm text-white/70">Total estimé: <span className="font-semibold text-white">{money(total)}</span></p>
          {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
        </CenteredFormLayout>
      </div>
    </div>
  )
}
