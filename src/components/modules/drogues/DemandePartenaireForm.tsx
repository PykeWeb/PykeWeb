'use client'

import { useMemo, useState } from 'react'
import { NotebookPen, Plus, Tags, User } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { computeDemandMetrics, type DemandMode } from '@/lib/drugProductionDemandCalculator'
import type { ProductionType } from '@/lib/drugProductionTrackingApi'

export type DemandFormValue = {
  partnerName: string
  type: ProductionType
  mode: DemandMode
  createdAt: string
  quantitySeeds: number
  quantityLeaves: number
  quantityBricks: number
  seedPrice: number
  pouchSalePrice: number
  brickTransformCost: number
  pouchTransformCost: number
  note: string
  expectedDate: string
}

const MODE_OPTIONS: { value: DemandMode; label: string }[] = [
  { value: 'seed_only', label: 'Achat graines' },
  { value: 'leaf_to_brick', label: 'Feuille → Brick' },
  { value: 'brick_to_pouch', label: 'Brick → Pochon' },
  { value: 'full_chain', label: 'Les 3 étapes' },
]

const TYPE_OPTIONS: { value: ProductionType; label: string }[] = [
  { value: 'coke', label: 'Coke' },
  { value: 'meth', label: 'Meth' },
  { value: 'other', label: 'Autres' },
]

export function DemandePartenaireForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: DemandFormValue
  submitLabel: string
  onSubmit: (value: DemandFormValue, expectedOutput: number) => Promise<void>
  onCancel?: () => void
}) {
  const [form, setForm] = useState<DemandFormValue>(initial)
  const [showNote, setShowNote] = useState(Boolean(initial.note))
  const [saving, setSaving] = useState(false)

  const calc = useMemo(() => computeDemandMetrics({
    mode: form.mode,
    quantitySeeds: form.quantitySeeds,
    quantityLeaves: form.quantityLeaves,
    quantityBricks: form.quantityBricks,
    seedPrice: form.seedPrice,
    pouchSalePrice: form.pouchSalePrice,
    brickTransformCost: form.brickTransformCost,
    pouchTransformCost: form.pouchTransformCost,
  }), [form])

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
        <div className="space-y-1 rounded-xl border border-cyan-300/20 bg-cyan-500/[0.08] p-2.5">
          <label className="flex items-center gap-1.5 text-xs text-cyan-100/80"><User className="h-3.5 w-3.5" />Nom du groupe</label>
          <Input value={form.partnerName} onChange={(e) => setForm((p) => ({ ...p, partnerName: e.target.value }))} />
        </div>
        <div className="space-y-1 rounded-xl border border-violet-300/20 bg-violet-500/[0.08] p-2.5">
          <label className="flex items-center gap-1.5 text-xs text-violet-100/80"><Tags className="h-3.5 w-3.5" />Type</label>
          <GlassSelect value={form.type} onChange={(v) => setForm((p) => ({ ...p, type: v as ProductionType }))} options={TYPE_OPTIONS} />
        </div>
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => setShowNote((v) => !v)} className="h-10 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 text-sm font-semibold text-amber-100">Note</button>
          {onCancel ? <SecondaryButton onClick={onCancel}>Retour</SecondaryButton> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/[0.07] p-3 space-y-3">
        <p className="text-sm font-semibold text-cyan-100">Prix & estimation</p>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          <div><p className="mb-1 text-xs text-white/70">Mode opération</p><GlassSelect value={form.mode} onChange={(v) => setForm((p) => ({ ...p, mode: v as DemandMode }))} options={MODE_OPTIONS} /></div>
          <div><p className="mb-1 text-xs text-white/70">Quantité graines</p><Input value={form.quantitySeeds} onChange={(e) => setForm((p) => ({ ...p, quantitySeeds: Number(e.target.value) || 0 }))} inputMode="numeric" /></div>
          <div><p className="mb-1 text-xs text-white/70">Attendu (auto)</p><Input value={calc.expectedOutput} readOnly /></div>
          <div><p className="mb-1 text-xs text-white/70">Prix graine</p><Input value={form.seedPrice} onChange={(e) => setForm((p) => ({ ...p, seedPrice: Number(e.target.value) || 0 }))} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/70">Prix vente pochon</p><Input value={form.pouchSalePrice} onChange={(e) => setForm((p) => ({ ...p, pouchSalePrice: Number(e.target.value) || 0 }))} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/70">Coût transfo brick</p><Input value={form.brickTransformCost} onChange={(e) => setForm((p) => ({ ...p, brickTransformCost: Number(e.target.value) || 0 }))} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/70">Coût transfo pochon</p><Input value={form.pouchTransformCost} onChange={(e) => setForm((p) => ({ ...p, pouchTransformCost: Number(e.target.value) || 0 }))} inputMode="decimal" /></div>
          <div><p className="mb-1 text-xs text-white/70">Date</p><Input type="date" value={form.createdAt} onChange={(e) => setForm((p) => ({ ...p, createdAt: e.target.value }))} /></div>
          <div><p className="mb-1 text-xs text-white/70">Date estimée retour</p><Input type="date" value={form.expectedDate} onChange={(e) => setForm((p) => ({ ...p, expectedDate: e.target.value }))} /></div>
        </div>

        {showNote ? (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs text-white/70"><NotebookPen className="h-3.5 w-3.5" />Note</p>
            <textarea value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} rows={3} className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-2 text-xs"><p>Coût graines</p><p className="text-lg font-semibold">{Math.round(calc.seedCostTotal)} $</p></div>
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-2 text-xs"><p>Total vente estimé</p><p className="text-lg font-semibold">{Math.round(calc.totalSaleEstimate)} $</p></div>
          <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-2 text-xs"><p>Coût transfo total</p><p className="text-lg font-semibold">{Math.round(calc.transformCostTotal)} $</p></div>
          <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-2 text-xs"><p>Bénéfice estimé</p><p className="text-lg font-semibold">{Math.round(calc.estimatedProfit)} $</p></div>
        </div>
      </div>

      <div className="flex justify-end">
        <PrimaryButton disabled={saving} onClick={async () => { setSaving(true); try { await onSubmit(form, calc.expectedOutput) } finally { setSaving(false) } }}><Plus className="h-4 w-4" />{submitLabel}</PrimaryButton>
      </div>
    </div>
  )
}
