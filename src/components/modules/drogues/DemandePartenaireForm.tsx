'use client'

import { useMemo, useState } from 'react'
import { ArrowRightLeft, Beaker, Factory, NotebookPen, Package, Sparkles, Waves, type LucideIcon } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import type { ProductionType } from '@/lib/drugProductionTrackingApi'

export type CokeMode = 'leaf_to_brick' | 'brick_to_pouch' | 'leaf_to_pouch'
export type MethMode = 'machine_transform'
export type DemandMode = CokeMode | MethMode

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

type SummaryMetrics = {
  sentValue: number
  sentLabel: string
  recoveredPouches: number
  seedCost: number
  transformCost: number
  resaleEstimate: number
  estimatedProfit: number
}

const COKE_MODES: Array<{ value: CokeMode; label: string; description: string; icon: LucideIcon }> = [
  { value: 'leaf_to_brick', label: 'Feuille → Brick', description: '1 transformation', icon: ArrowRightLeft },
  { value: 'brick_to_pouch', label: 'Brick → Pochon', description: '1 transformation', icon: Package },
  { value: 'leaf_to_pouch', label: 'Feuille → Pochon', description: '2 transformations', icon: Sparkles },
]

function sanitizeNumber(value: unknown) {
  return Math.max(0, Number(value || 0) || 0)
}

function computeSummary(form: DemandFormValue): SummaryMetrics {
  const seedQty = Math.floor(sanitizeNumber(form.quantitySeeds))
  const leavesQty = Math.floor(sanitizeNumber(form.quantityLeaves))
  const bricksQty = Math.floor(sanitizeNumber(form.quantityBricks))
  const seedPrice = sanitizeNumber(form.seedPrice)
  const pouchSalePrice = sanitizeNumber(form.pouchSalePrice)
  const leafToBrickCost = sanitizeNumber(form.brickTransformCost)
  const brickToPouchCost = sanitizeNumber(form.pouchTransformCost)

  if (form.type === 'meth') {
    const tableQty = seedQty
    const methBrutQty = leavesQty
    const expectedPouches = Math.max(0, bricksQty > 0 ? bricksQty : methBrutQty * 2)
    const seedCost = tableQty * seedPrice
    const transformCost = brickToPouchCost
    const resaleEstimate = expectedPouches * pouchSalePrice
    return {
      sentValue: methBrutQty,
      sentLabel: 'Meth brut envoyée',
      recoveredPouches: expectedPouches,
      seedCost,
      transformCost,
      resaleEstimate,
      estimatedProfit: resaleEstimate - seedCost - transformCost,
    }
  }

  const netBricks = Math.floor(leavesQty * 0.95)
  const estimatedPouches =
    form.mode === 'brick_to_pouch'
      ? bricksQty * 10
      : form.mode === 'leaf_to_brick'
        ? netBricks * 10
        : netBricks * 10

  const seedCost = seedQty * seedPrice
  const transformCost =
    form.mode === 'leaf_to_brick'
      ? leavesQty * leafToBrickCost
      : form.mode === 'brick_to_pouch'
        ? bricksQty * brickToPouchCost
        : leavesQty * (leafToBrickCost + brickToPouchCost)

  const resaleEstimate = estimatedPouches * pouchSalePrice

  return {
    sentValue: leavesQty,
    sentLabel: 'Feuilles envoyées',
    recoveredPouches: estimatedPouches,
    seedCost,
    transformCost,
    resaleEstimate,
    estimatedProfit: resaleEstimate - seedCost - transformCost,
  }
}

function normalizeInitialMode(initial: DemandFormValue): DemandMode {
  if (initial.type === 'meth') return 'machine_transform'
  if (initial.mode === 'leaf_to_brick' || initial.mode === 'brick_to_pouch' || initial.mode === 'leaf_to_pouch') return initial.mode
  return 'leaf_to_pouch'
}

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
  const [form, setForm] = useState<DemandFormValue>({
    ...initial,
    type: initial.type === 'meth' ? 'meth' : 'coke',
    mode: normalizeInitialMode(initial),
  })
  const [showNote, setShowNote] = useState(Boolean(initial.note))
  const [saving, setSaving] = useState(false)

  const summary = useMemo(() => computeSummary(form), [form])
  const isMeth = form.type === 'meth'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-2xl border border-white/15 bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, type: 'coke', mode: prev.mode === 'machine_transform' ? 'leaf_to_pouch' : prev.mode }))}
            className={`h-9 rounded-xl px-4 text-sm font-semibold ${!isMeth ? 'bg-cyan-500/25 text-cyan-100' : 'text-white/75 hover:bg-white/10'}`}
          >
            Coke
          </button>
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, type: 'meth', mode: 'machine_transform' }))}
            className={`h-9 rounded-xl px-4 text-sm font-semibold ${isMeth ? 'bg-violet-500/25 text-violet-100' : 'text-white/75 hover:bg-white/10'}`}
          >
            Meth
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowNote((v) => !v)} className="h-9 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-100">Note</button>
          {onCancel ? <SecondaryButton onClick={onCancel}>Retour</SecondaryButton> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/[0.07] p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-white/80">
            <span>Nom du groupe</span>
            <Input value={form.partnerName} onChange={(e) => setForm((prev) => ({ ...prev, partnerName: e.target.value }))} />
          </label>
          <div className="space-y-1 text-sm text-white/80">
            <span>Mode opération</span>
            {isMeth ? (
              <div className="h-10 rounded-xl border border-white/20 bg-white/[0.06] px-3 text-sm font-semibold leading-10 text-white">Machine + transfo (mode unique)</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3">
                {COKE_MODES.map((mode) => {
                  const Icon = mode.icon
                  const active = form.mode === mode.value
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, mode: mode.value }))}
                      className={`rounded-xl border p-2 text-left ${active ? 'border-cyan-300/40 bg-cyan-500/15' : 'border-white/15 bg-white/[0.03] hover:bg-white/[0.08]'}`}
                    >
                      <p className="flex items-center gap-1 text-sm font-semibold"><Icon className="h-3.5 w-3.5" />{mode.label}</p>
                      <p className="text-xs text-white/65">{mode.description}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {isMeth ? (
            <>
              <label className="space-y-1 text-sm text-white/80"><span>Quantité de machines achetées</span><Input value={form.quantitySeeds} onChange={(e) => setForm((prev) => ({ ...prev, quantitySeeds: sanitizeNumber(e.target.value) }))} inputMode="numeric" /></label>
              <label className="space-y-1 text-sm text-white/80"><span>Prix d’une table</span><Input value={form.seedPrice} onChange={(e) => setForm((prev) => ({ ...prev, seedPrice: sanitizeNumber(e.target.value) }))} inputMode="decimal" /></label>
              <label className="space-y-1 text-sm text-white/80"><span>Meth brut produite</span><Input value={form.quantityLeaves} onChange={(e) => setForm((prev) => ({ ...prev, quantityLeaves: sanitizeNumber(e.target.value) }))} inputMode="numeric" /></label>
              <label className="space-y-1 text-sm text-white/80"><span>Pochons à récupérer (estimé)</span><Input value={form.quantityBricks} onChange={(e) => setForm((prev) => ({ ...prev, quantityBricks: sanitizeNumber(e.target.value) }))} inputMode="numeric" /></label>
              <label className="space-y-1 text-sm text-white/80"><span>Prix revente pochon</span><Input value={form.pouchSalePrice} onChange={(e) => setForm((prev) => ({ ...prev, pouchSalePrice: sanitizeNumber(e.target.value) }))} inputMode="decimal" /></label>
              <label className="space-y-1 text-sm text-white/80"><span>Prix total transfo</span><Input value={form.pouchTransformCost} onChange={(e) => setForm((prev) => ({ ...prev, pouchTransformCost: sanitizeNumber(e.target.value) }))} inputMode="decimal" /></label>
            </>
          ) : (
            <>
              <label className="space-y-1 text-sm text-white/80"><span>Graine achetée (quantité)</span><Input value={form.quantitySeeds} onChange={(e) => setForm((prev) => ({ ...prev, quantitySeeds: sanitizeNumber(e.target.value) }))} inputMode="numeric" /></label>
              <label className="space-y-1 text-sm text-white/80"><span>Prix d’achat graines</span><Input value={form.seedPrice} onChange={(e) => setForm((prev) => ({ ...prev, seedPrice: sanitizeNumber(e.target.value) }))} inputMode="decimal" /></label>
              <label className="space-y-1 text-sm text-white/80"><span>Quantité de feuilles</span><Input value={form.quantityLeaves} onChange={(e) => setForm((prev) => ({ ...prev, quantityLeaves: sanitizeNumber(e.target.value) }))} inputMode="numeric" /></label>
              {form.mode === 'brick_to_pouch' ? <label className="space-y-1 text-sm text-white/80"><span>Quantité de bricks</span><Input value={form.quantityBricks} onChange={(e) => setForm((prev) => ({ ...prev, quantityBricks: sanitizeNumber(e.target.value) }))} inputMode="numeric" /></label> : null}
              <label className="space-y-1 text-sm text-white/80"><span>Prix transfo feuille → brick</span><Input value={form.brickTransformCost} onChange={(e) => setForm((prev) => ({ ...prev, brickTransformCost: sanitizeNumber(e.target.value) }))} inputMode="decimal" /></label>
              <label className="space-y-1 text-sm text-white/80"><span>Prix transfo brick → pochon</span><Input value={form.pouchTransformCost} onChange={(e) => setForm((prev) => ({ ...prev, pouchTransformCost: sanitizeNumber(e.target.value) }))} inputMode="decimal" /></label>
              <label className="space-y-1 text-sm text-white/80"><span>Prix revente pochon</span><Input value={form.pouchSalePrice} onChange={(e) => setForm((prev) => ({ ...prev, pouchSalePrice: sanitizeNumber(e.target.value) }))} inputMode="decimal" /></label>
            </>
          )}

          <label className="space-y-1 text-sm text-white/80"><span>Date</span><Input type="date" value={form.createdAt} onChange={(e) => setForm((prev) => ({ ...prev, createdAt: e.target.value }))} /></label>
          <label className="space-y-1 text-sm text-white/80"><span>Date estimée retour</span><Input type="date" value={form.expectedDate} onChange={(e) => setForm((prev) => ({ ...prev, expectedDate: e.target.value }))} /></label>
        </div>

        {showNote ? (
          <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/8 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs text-amber-100/90"><NotebookPen className="h-3.5 w-3.5" />Note</p>
            <textarea value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} rows={3} className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-violet-300/20 bg-violet-500/[0.07] p-4">
        <p className="mb-3 text-sm font-semibold text-violet-100">Résumé estimation</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3"><p className="text-xs text-white/70">Envoyé</p><p className="mt-1 text-lg font-semibold">{summary.sentValue}</p><p className="text-xs text-white/55">{summary.sentLabel}</p></div>
          <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3"><p className="text-xs text-white/70">Récupéré (approx)</p><p className="mt-1 text-lg font-semibold">{summary.recoveredPouches}</p><p className="text-xs text-white/55">Pochons</p></div>
          <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3"><p className="text-xs text-white/70">Prix transfo</p><p className="mt-1 text-lg font-semibold">{Math.round(summary.transformCost)} $</p></div>
          <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3"><p className="text-xs text-white/70">Revente estimée</p><p className="mt-1 text-lg font-semibold">{Math.round(summary.resaleEstimate)} $</p></div>
          <div className="rounded-xl border border-cyan-300/30 bg-cyan-500/15 p-3"><p className="text-xs text-cyan-100/85">Bénéfice approx</p><p className="mt-1 text-lg font-semibold text-cyan-100">{Math.round(summary.estimatedProfit)} $</p><p className="text-xs text-cyan-100/70">Coût graines/tables: {Math.round(summary.seedCost)} $</p></div>
        </div>
      </div>

      <div className="flex justify-end">
        <PrimaryButton
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              await onSubmit(form, summary.recoveredPouches)
            } finally {
              setSaving(false)
            }
          }}
        >
          <Waves className="h-4 w-4" />
          {submitLabel}
        </PrimaryButton>
      </div>
    </div>
  )
}
