'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Beaker, CalendarClock, CheckCircle2, CircleDollarSign, Factory, FlaskConical, Package, Plus, Rows3, Tags, User2, XCircle } from 'lucide-react'
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
  tableQty?: number
  imageUrl?: string | null
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

function typeLabel(type: string) {
  return String(type || '').toLowerCase().includes('meth') ? 'Meth' : 'Coke'
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
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId])
  const counters = useMemo(() => {
    const pending = rows.filter((row) => row.status === 'in_progress')
    return {
      total: rows.length,
      pending: pending.length,
      completed: rows.filter((row) => row.status === 'completed').length,
      cancelled: rows.filter((row) => row.status === 'cancelled').length,
      pendingMethPouches: pending.filter((row) => String(row.type).toLowerCase().includes('meth')).reduce((sum, row) => sum + Math.max(0, Number(row.expected_output || 0)), 0),
      pendingCokePouches: pending.filter((row) => String(row.type).toLowerCase().includes('coke')).reduce((sum, row) => sum + Math.max(0, Number(row.expected_output || 0)), 0),
    }
  }, [rows])
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

  async function uploadProof(file: File | null) {
    if (!file) return
    setUploadingProof(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      const res = await fetch('/api/drogues/suivi-production/upload-image', { method: 'POST', body: formData })
      const payload = (await res.json().catch(() => null)) as { publicUrl?: string; error?: string } | null
      if (!res.ok || !payload?.publicUrl) throw new Error(payload?.error || 'Upload image impossible.')
      setProofImageUrl(payload.publicUrl)
      toast.success('Image ajoutée.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Upload image impossible.')
    } finally {
      setUploadingProof(false)
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
      tableQty: isMeth ? Math.max(0, Number(form.quantitySeeds || 0)) : undefined,
      imageUrl: proofImageUrl,
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
      setProofImageUrl(null)
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

  return (
    <div className="space-y-8 pb-6">
      <PageHeader title="Transfo groupes" subtitle="Coke/Meth séparés, estimation métier claire et validation finale de la quantité réellement récupérée." />

      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <PrimaryButton onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Nouvelle demande</PrimaryButton>
          <Link href={selected ? `/drogues/demandes/${selected.id}` : '/drogues/suivi-production'} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold hover:bg-white/[0.12]"><Rows3 className="h-4 w-4" />Vue détails</Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
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
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-fuchsia-300/35 bg-fuchsia-500/12 p-3">
          <p className="text-xs text-fuchsia-100/80">Pochons meth en attente</p>
          <p className="text-xl font-semibold text-fuchsia-100">{counters.pendingMethPouches}</p>
        </div>
        <div className="rounded-xl border border-sky-300/35 bg-sky-500/12 p-3">
          <p className="text-xs text-sky-100/80">Pochons coke en attente</p>
          <p className="text-xl font-semibold text-sky-100">{counters.pendingCokePouches}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Panel className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Liste des demandes</h3>
            <span className="rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1 text-xs text-white/70">{visibleRows.length} affichée(s)</span>
          </div>
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
                      <td className="px-3 py-2 font-medium"><span className="inline-flex items-center gap-1.5"><User2 className="h-3.5 w-3.5 text-white/60" />{row.partner_name}</span></td>
                      <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5">{String(row.type || '').toLowerCase().includes('meth') ? <FlaskConical className="h-3.5 w-3.5 text-fuchsia-200" /> : <Beaker className="h-3.5 w-3.5 text-sky-200" />}{typeLabel(String(row.type || ''))}</span></td>
                      <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5"><Tags className="h-3.5 w-3.5 text-white/60" />{toModeLabel(meta?.mode || '')}</span></td>
                      <td className="px-3 py-2">{meta?.sentQty ?? row.quantity_sent}</td>
                      <td className="px-3 py-2">{row.received_output}/{row.expected_output}</td>
                      <td className="px-3 py-2"><span className={`rounded-lg border px-2 py-1 text-xs ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                      <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-white/60" />{new Date(row.created_at).toLocaleDateString('fr-FR')}</span></td>
                      <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5"><CircleDollarSign className="h-3.5 w-3.5 text-emerald-200" />{Math.round(computeEstimatedProfit(row))} $</span></td>
                    </tr>
                  )
                }) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="space-y-4 p-5">
          <h3 className="text-base font-semibold">Validation finale</h3>
          {!selected ? <p className="text-sm text-white/65">Sélectionne une demande pour la valider/modifier.</p> : (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm sm:grid-cols-2">
                <p className="inline-flex items-center gap-1.5"><User2 className="h-3.5 w-3.5 text-white/60" />Groupe: <b>{selected.partner_name}</b></p>
                <p className="inline-flex items-center gap-1.5">{String(selected.type || '').toLowerCase().includes('meth') ? <FlaskConical className="h-3.5 w-3.5 text-fuchsia-200" /> : <Beaker className="h-3.5 w-3.5 text-sky-200" />}Type: <b>{typeLabel(String(selected.type || ''))}</b></p>
                <p className="inline-flex items-center gap-1.5"><Factory className="h-3.5 w-3.5 text-white/60" />Envoyé: <b>{parseMeta(selected.note)?.sentQty ?? selected.quantity_sent}</b></p>
                <p className="inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-white/60" />Pochons prévus: <b>{selected.expected_output}</b></p>
                <p className="inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-cyan-200" />Pochons reçus: <b>{selected.received_output}</b></p>
                <p>Statut: <b>{statusLabel(selected.status)}</b></p>
              </div>
              {parseMeta(selected.note)?.imageUrl ? (
                <div className="overflow-hidden rounded-xl border border-white/15 bg-white/[0.04] p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={parseMeta(selected.note)?.imageUrl || ''} alt="Preuve demande" className="max-h-56 w-full rounded-lg object-cover" />
                </div>
              ) : null}

              <label className="space-y-1 text-sm text-white/80">
                <span className="inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-cyan-200" />Quantité réellement reçue (validation)</span>
                <Input value={validationDraft} onChange={(e) => setValidationDraft(e.target.value)} inputMode="numeric" />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <PrimaryButton onClick={() => void validateSelected()}><CheckCircle2 className="h-4 w-4" />Valider la demande</PrimaryButton>
                <SecondaryButton onClick={() => void cancelSelected()}><XCircle className="h-4 w-4" />Annuler la demande</SecondaryButton>
              </div>

              <Link href={`/drogues/suivi-production/${selected.id}`} className="inline-flex h-10 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/25">Ouvrir la page détail / édition</Link>
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
            <div className="mt-3 rounded-xl border border-white/12 bg-white/[0.03] p-3">
              <p className="mb-2 text-xs text-white/70">Image (optionnelle)</p>
              <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={(e) => void uploadProof(e.target.files?.[0] || null)} disabled={uploadingProof} className="text-xs text-white/85 file:mr-3 file:rounded-lg file:border file:border-white/25 file:bg-white/[0.08] file:px-3 file:py-1.5" />
              {proofImageUrl ? (
                <div className="mt-2 overflow-hidden rounded-lg border border-white/15">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proofImageUrl} alt="Aperçu preuve" className="max-h-48 w-full object-cover" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
