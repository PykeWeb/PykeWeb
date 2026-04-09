'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Plus, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { DemandePartenaireForm, type DemandFormValue } from '@/components/modules/drogues/DemandePartenaireForm'
import {
  createDrugProductionTracking,
  listDrugProductionTrackings,
  updateDrugProductionTracking,
  type DrugProductionTrackingRow,
  type ProductionStatus,
} from '@/lib/drugProductionTrackingApi'

type RequestMeta = {
  mode: string
  sentLabel: string
  sentQty: number
  estimatedPouches: number
}

const NEW_REQUEST_INITIAL: DemandFormValue = {
  partnerName: '',
  type: 'coke',
  mode: 'leaf_to_pouch',
  createdAt: new Date().toISOString().slice(0, 10),
  expectedDate: '',
  quantitySeeds: 0,
  quantityLeaves: 0,
  quantityBricks: 0,
  seedPrice: 0,
  pouchSalePrice: 0,
  brickTransformCost: 0,
  pouchTransformCost: 0,
  note: '',
}

function parseMeta(note: string | null | undefined): RequestMeta | null {
  const raw = String(note || '').trim()
  if (!raw.startsWith('[transfo:v2]')) return null
  try {
    return JSON.parse(raw.slice('[transfo:v2]'.length)) as RequestMeta
  } catch {
    return null
  }
}

function toModeLabel(mode: string) {
  if (mode === 'leaf_to_brick') return 'Feuille → Brick'
  if (mode === 'brick_to_pouch') return 'Brick → Pochon'
  if (mode === 'leaf_to_pouch') return 'Feuille → Pochon'
  if (mode === 'tables_purchase') return 'Achat tables meth'
  return mode || '—'
}

function statusLabel(status: ProductionStatus) {
  if (status === 'completed') return 'Validée'
  if (status === 'cancelled') return 'Annulée'
  return 'En attente'
}

function statusClass(status: ProductionStatus) {
  if (status === 'completed') return 'border-emerald-300/35 bg-emerald-500/15 text-emerald-100'
  if (status === 'cancelled') return 'border-rose-300/35 bg-rose-500/15 text-rose-100'
  return 'border-amber-300/35 bg-amber-500/15 text-amber-100'
}

function computeEstimatedProfit(row: DrugProductionTrackingRow) {
  const sale = Math.max(0, Number(row.expected_output || 0)) * Math.max(0, Number(row.pouch_sale_price || 0))
  if (String(row.type || '').toLowerCase().includes('meth')) {
    const tableCost = Math.max(0, Number(row.quantity_sent || 0)) * Math.max(0, Number(row.seed_price || 0))
    return sale - tableCost
  }
  const seedCost = Math.max(0, Number(row.seed_price || 0)) * Math.max(0, Number(row.quantity_sent || 0))
  const transform = Math.max(0, Number(row.brick_transform_cost || 0)) + Math.max(0, Number(row.pouch_transform_cost || 0))
  return sale - seedCost - transform
}

export default function SuiviProductionClient() {
  const [rows, setRows] = useState<DrugProductionTrackingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [validationDraft, setValidationDraft] = useState('0')
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed' | 'cancelled'>('all')

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId])
  const counters = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((row) => row.status === 'in_progress').length,
    completed: rows.filter((row) => row.status === 'completed').length,
    cancelled: rows.filter((row) => row.status === 'cancelled').length,
  }), [rows])
  const visibleRows = useMemo(() => {
    if (statusFilter === 'all') return rows
    return rows.filter((row) => row.status === statusFilter)
  }, [rows, statusFilter])

  async function loadRows() {
    setLoading(true)
    try {
      const data = await listDrugProductionTrackings()
      setRows(data)
      setSelectedId((prev) => prev ?? data[0]?.id ?? null)
    } catch {
      toast.error('Impossible de charger les demandes transfo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRows()
  }, [])

  useEffect(() => {
    setValidationDraft(String(Math.max(0, Number(selected?.received_output || 0))))
  }, [selected?.id, selected?.received_output])

  async function createRequest(form: DemandFormValue, expectedOutput: number) {
    const isMeth = form.type === 'meth'
    const quantitySent = isMeth
      ? Math.max(0, Number(form.quantitySeeds || 0))
      : form.mode === 'brick_to_pouch'
        ? Math.max(0, Number(form.quantityBricks || 0))
        : Math.max(0, Number(form.quantityLeaves || 0))

    const meta: RequestMeta = {
      mode: form.mode,
      sentLabel: isMeth ? 'Meth brut produite' : 'Feuilles envoyées',
      sentQty: isMeth ? Math.max(0, Number(form.quantityLeaves || 0)) : quantitySent,
      estimatedPouches: expectedOutput,
    }

    await createDrugProductionTracking({
      partnerName: form.partnerName,
      type: form.type,
      quantitySent,
      ratio: 1,
      expectedOutput,
      receivedOutput: 0,
      note: `[transfo:v2]${JSON.stringify(meta)}`,
      createdAt: form.createdAt,
      expectedDate: form.expectedDate || undefined,
      seedPrice: form.seedPrice,
      pouchSalePrice: form.pouchSalePrice,
      brickTransformCost: form.brickTransformCost,
      pouchTransformCost: isMeth ? 0 : form.pouchTransformCost,
    })
  }

  async function submitCreate(form: DemandFormValue, expectedOutput: number) {
    setSaving(true)
    try {
      await createRequest(form, expectedOutput)
      toast.success('Demande créée en attente.')
      setCreating(false)
      await loadRows()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Création impossible.')
    } finally {
      setSaving(false)
    }
  }

  async function validateSelected() {
    if (!selected) return
    const received = Math.max(0, Math.floor(Number(validationDraft || 0) || 0))
    try {
      const updated = await updateDrugProductionTracking(selected.id, {
        receivedOutput: received,
        status: received >= Math.max(0, Number(selected.expected_output || 0)) ? 'completed' : 'in_progress',
      })
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      toast.success('Validation enregistrée.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Validation impossible.')
    }
  }

  async function cancelSelected() {
    if (!selected) return
    try {
      const updated = await updateDrugProductionTracking(selected.id, { status: 'cancelled' })
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      toast.success('Demande annulée.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Annulation impossible.')
    }
  }

  async function markSelectedPending() {
    if (!selected) return
    try {
      const updated = await updateDrugProductionTracking(selected.id, { status: 'in_progress' })
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      toast.success('Demande remise en attente.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Action impossible.')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Transfo groupes" subtitle="Coke/Meth séparés, estimation métier claire et validation finale de la quantité réellement récupérée." />

      <div className="flex flex-wrap gap-2">
        <PrimaryButton onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Nouvelle demande</PrimaryButton>
        <Link href="/drogues/demandes" className="inline-flex h-10 items-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold hover:bg-white/[0.12]">Vue détails</Link>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <button type="button" onClick={() => setStatusFilter('in_progress')} className="rounded-xl border border-amber-300/35 bg-amber-500/12 p-3 text-left">
          <p className="text-xs text-amber-100/80">En attente</p>
          <p className="text-xl font-semibold text-amber-100">{counters.pending}</p>
        </button>
        <button type="button" onClick={() => setStatusFilter('completed')} className="rounded-xl border border-emerald-300/35 bg-emerald-500/12 p-3 text-left">
          <p className="text-xs text-emerald-100/80">Validées</p>
          <p className="text-xl font-semibold text-emerald-100">{counters.completed}</p>
        </button>
        <button type="button" onClick={() => setStatusFilter('cancelled')} className="rounded-xl border border-rose-300/35 bg-rose-500/12 p-3 text-left">
          <p className="text-xs text-rose-100/80">Annulées</p>
          <p className="text-xl font-semibold text-rose-100">{counters.cancelled}</p>
        </button>
        <button type="button" onClick={() => setStatusFilter('all')} className="rounded-xl border border-cyan-300/35 bg-cyan-500/12 p-3 text-left">
          <p className="text-xs text-cyan-100/80">Total demandes</p>
          <p className="text-xl font-semibold text-cyan-100">{counters.total}</p>
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Panel>
          <h3 className="mb-3 text-base font-semibold">Liste des demandes</h3>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.04] text-white/70">
                <tr>
                  <th className="px-3 py-2 text-left">Groupe</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Mode</th>
                  <th className="px-3 py-2 text-left">Envoyé</th>
                  <th className="px-3 py-2 text-left">Récupéré</th>
                  <th className="px-3 py-2 text-left">Statut</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Bénéf. estimé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? <tr><td className="px-3 py-6 text-center text-white/65" colSpan={8}>Chargement…</td></tr> : null}
                {!loading && visibleRows.length === 0 ? <tr><td className="px-3 py-6 text-center text-white/65" colSpan={8}>Aucune demande.</td></tr> : null}
                {!loading ? visibleRows.map((row) => {
                  const meta = parseMeta(row.note)
                  const isSelected = selectedId === row.id
                  return (
                    <tr key={row.id} className={`cursor-pointer ${isSelected ? 'bg-cyan-500/[0.08]' : 'hover:bg-white/[0.03]'}`} onClick={() => setSelectedId(row.id)}>
                      <td className="px-3 py-2 font-medium">{row.partner_name}</td>
                      <td className="px-3 py-2">{String(row.type || '').toUpperCase()}</td>
                      <td className="px-3 py-2">{toModeLabel(meta?.mode || '')}</td>
                      <td className="px-3 py-2">{meta?.sentQty ?? row.quantity_sent}</td>
                      <td className="px-3 py-2">{row.received_output}/{row.expected_output}</td>
                      <td className="px-3 py-2"><span className={`rounded-lg border px-2 py-1 text-xs ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                      <td className="px-3 py-2">{new Date(row.created_at).toLocaleDateString('fr-FR')}</td>
                      <td className="px-3 py-2">{Math.round(computeEstimatedProfit(row))} $</td>
                    </tr>
                  )
                }) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <h3 className="mb-3 text-base font-semibold">Validation finale</h3>
          {!selected ? <p className="text-sm text-white/65">Sélectionne une demande pour la valider/modifier.</p> : (
            <div className="space-y-3">
              <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm sm:grid-cols-2">
                <p>Groupe: <b>{selected.partner_name}</b></p>
                <p>Type: <b>{String(selected.type || '').toUpperCase()}</b></p>
                <p>Envoyé: <b>{parseMeta(selected.note)?.sentQty ?? selected.quantity_sent}</b></p>
                <p>Pochons prévus: <b>{selected.expected_output}</b></p>
                <p>Pochons reçus: <b>{selected.received_output}</b></p>
                <p>Statut: <b>{statusLabel(selected.status)}</b></p>
              </div>

              <label className="space-y-1 text-sm text-white/80">
                <span>Quantité réellement reçue (validation)</span>
                <Input value={validationDraft} onChange={(e) => setValidationDraft(e.target.value)} inputMode="numeric" />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <PrimaryButton onClick={() => void validateSelected()}><CheckCircle2 className="h-4 w-4" />Valider la demande</PrimaryButton>
                <SecondaryButton onClick={() => void cancelSelected()}><XCircle className="h-4 w-4" />Annuler la demande</SecondaryButton>
              </div>
              <SecondaryButton onClick={() => void markSelectedPending()}>Remettre en attente</SecondaryButton>

              <Link href={`/drogues/suivi-production/${selected.id}`} className="inline-flex text-sm text-cyan-100 underline-offset-4 hover:underline">Ouvrir la page détail / édition</Link>
            </div>
          )}
        </Panel>
      </div>

      {creating ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl border border-white/15 bg-[#0a1221]/95 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Nouvelle demande</h3>
              <button type="button" onClick={() => setCreating(false)} className="h-9 rounded-xl border border-white/15 px-3 text-sm hover:bg-white/[0.08]">Fermer</button>
            </div>
            <DemandePartenaireForm
              initial={NEW_REQUEST_INITIAL}
              submitLabel={saving ? 'Création…' : 'Créer la demande'}
              onSubmit={submitCreate}
              onCancel={() => setCreating(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
