'use client'

import { useEffect, useMemo, useState } from 'react'
import { Beaker, CheckCircle2, Clock3, Coins, Factory, FlaskConical, Plus, ReceiptText, Save, Sparkles, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { listCatalogItemsUnified } from '@/lib/itemsApi'
import {
  createDrugProductionTracking,
  listDrugProductionTrackings,
  updateDrugProductionTracking,
  type DrugProductionTrackingRow,
  type ProductionStatus,
  type ProductionType,
} from '@/lib/drugProductionTrackingApi'

const TYPE_OPTIONS: { value: ProductionType; label: string }[] = [
  { value: 'coke', label: 'Coke' },
  { value: 'meth', label: 'Meth' },
  { value: 'other', label: 'Autres' },
]

const NEW_REQUEST_INITIAL = {
  partnerName: '',
  type: 'coke' as ProductionType,
  quantitySent: 100,
  ratio: 3,
  createdAt: new Date().toISOString().slice(0, 10),
  expectedDate: '',
  note: '',
}

const BRICK_TAX_PERCENT = 5
const POUCHES_PER_BRICK = 10
const POUCH_BATCH_SIZE = 10

function money(value: number) {
  return `${Math.round(value)} $`
}

function normalize(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function typeLabel(type: ProductionType) {
  if (type === 'coke') return 'Coke'
  if (type === 'meth') return 'Meth'
  return 'Autres'
}

function statusLabel(status: ProductionStatus) {
  if (status === 'completed') return 'Terminé'
  if (status === 'cancelled') return 'Annulé'
  return 'En cours'
}

function statusClass(status: ProductionStatus) {
  if (status === 'completed') return 'border-emerald-300/35 bg-emerald-500/15 text-emerald-100'
  if (status === 'cancelled') return 'border-rose-300/35 bg-rose-500/15 text-rose-100'
  return 'border-amber-300/35 bg-amber-500/15 text-amber-100'
}

export default function SuiviProductionClient() {
  const [rows, setRows] = useState<DrugProductionTrackingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newRequest, setNewRequest] = useState(NEW_REQUEST_INITIAL)
  const [receivedInput, setReceivedInput] = useState('0')
  const [noteInput, setNoteInput] = useState('')
  const [pouchSalePrice, setPouchSalePrice] = useState(0)
  const [brickTransformCost, setBrickTransformCost] = useState(0)
  const [pouchTransformCost, setPouchTransformCost] = useState(0)
  const [assetImages, setAssetImages] = useState<{ pouch: string | null; brick: string | null; leaf: string | null }>({ pouch: null, brick: null, leaf: null })

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  )

  const expectedFromForm = useMemo(() => {
    const leaves = Math.max(0, Number(newRequest.quantitySent || 0) * Number(newRequest.ratio || 0))
    const netBricks = Math.max(0, leaves * (1 - BRICK_TAX_PERCENT / 100))
    return Math.max(0, Math.floor(netBricks * POUCHES_PER_BRICK))
  },
    [newRequest.quantitySent, newRequest.ratio]
  )

  const conversionFromForm = useMemo(() => {
    const leaves = Math.max(0, Number(newRequest.quantitySent || 0) * Number(newRequest.ratio || 0))
    const netBricks = Math.max(0, leaves * (1 - BRICK_TAX_PERCENT / 100))
    const pouches = Math.max(0, Math.floor(netBricks * POUCHES_PER_BRICK))
    return { leaves, netBricks, pouches }
  }, [newRequest.quantitySent, newRequest.ratio])

  const stats = useMemo(() => {
    const inProgress = rows.filter((r) => r.status === 'in_progress').length
    const completed = rows.filter((r) => r.status === 'completed').length
    const expected = rows.reduce((sum, r) => sum + Number(r.expected_output || 0), 0)
    const received = rows.reduce((sum, r) => sum + Number(r.received_output || 0), 0)
    const expectedRevenue = expected * pouchSalePrice
    const receivedRevenue = received * pouchSalePrice
    return { inProgress, completed, expected, received, expectedRevenue, receivedRevenue }
  }, [rows, pouchSalePrice])

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const data = await listDrugProductionTrackings()
        if (!mounted) return
        setRows(data)
        if (data.length > 0) {
          setSelectedId(data[0].id)
          setReceivedInput(String(data[0].received_output || 0))
          setNoteInput(data[0].note || '')
        }
      } catch {
        toast.error('Impossible de charger le suivi de production.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    void listCatalogItemsUnified()
      .then((items) => {
        const pouch = items.find((item) => normalize(item.name).includes('pochon'))
        const brick = items.find((item) => normalize(item.name).includes('brique'))
        const leaf = items.find((item) => normalize(item.name).includes('feuille'))
        if (pouch) {
          setPouchSalePrice(Math.max(0, Number(pouch.sell_price || pouch.buy_price || 0)))
        }
        setAssetImages({
          pouch: pouch?.image_url || null,
          brick: brick?.image_url || null,
          leaf: leaf?.image_url || null,
        })
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!selected) return
    setReceivedInput(String(selected.received_output || 0))
    setNoteInput(selected.note || '')
  }, [selected])

  const progress = useMemo(() => {
    if (!selected) return 0
    if (!selected.expected_output) return 0
    return Math.min(100, Math.round((selected.received_output / selected.expected_output) * 100))
  }, [selected])

  const remaining = useMemo(() => {
    if (!selected) return 0
    return Math.max(0, Number(selected.expected_output || 0) - Number(selected.received_output || 0))
  }, [selected])

  const selectedFinance = useMemo(() => {
    if (!selected) return { brickCount: 0, pouchCost: 0, brickCost: 0, revenue: 0, estimatedProfit: 0 }
    const brickCount = selected.expected_output / POUCHES_PER_BRICK
    const revenue = selected.expected_output * pouchSalePrice
    const brickCost = brickCount * brickTransformCost
    const pouchCost = (selected.expected_output / POUCH_BATCH_SIZE) * pouchTransformCost
    return {
      brickCount,
      brickCost,
      pouchCost,
      revenue,
      estimatedProfit: revenue - brickCost - pouchCost,
    }
  }, [brickTransformCost, pouchSalePrice, pouchTransformCost, selected])

  async function handleCreateRequest() {
    if (!newRequest.partnerName.trim()) {
      toast.error('Le nom du groupe est obligatoire.')
      return
    }

    setSaving(true)
    try {
      const created = await createDrugProductionTracking({
        partnerName: newRequest.partnerName.trim(),
        type: newRequest.type,
        quantitySent: Number(newRequest.quantitySent || 0),
        ratio: Number(newRequest.ratio || 0),
        note: newRequest.note,
        createdAt: newRequest.createdAt || undefined,
        expectedDate: newRequest.expectedDate || undefined,
      })
      setRows((prev) => [created, ...prev])
      setSelectedId(created.id)
      setCreating(false)
      setNewRequest(NEW_REQUEST_INITIAL)
      toast.success('Demande de production créée.')
    } catch {
      toast.error('Impossible de créer la demande.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateSelected(mode: 'validate' | 'edit') {
    if (!selected) return
    setSaving(true)
    try {
      const received = Math.max(0, Math.floor(Number(receivedInput || 0)))
      const nextStatus: ProductionStatus | undefined = mode === 'validate'
        ? (received >= selected.expected_output ? 'completed' : 'in_progress')
        : undefined

      const updated = await updateDrugProductionTracking(selected.id, {
        receivedOutput: received,
        note: noteInput,
        status: nextStatus,
      })

      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      toast.success(mode === 'validate' ? 'Réception validée.' : 'Demande modifiée.')
    } catch {
      toast.error('Mise à jour impossible.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Suivi Production" subtitle="Suivi des transformations externes (coke, meth...)" />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="border-sky-300/25 bg-gradient-to-br from-sky-500/15 to-blue-600/15">
          <div className="flex items-center justify-between text-sky-100/90"><p className="text-xs">Total en cours</p><Clock3 className="h-4 w-4" /></div>
          <p className="mt-3 text-3xl font-semibold">{stats.inProgress}</p>
        </Panel>
        <Panel className="border-violet-300/25 bg-gradient-to-br from-violet-500/15 to-fuchsia-600/15">
          <div className="flex items-center justify-between text-violet-100/90"><p className="text-xs">Total terminé</p><CheckCircle2 className="h-4 w-4" /></div>
          <p className="mt-3 text-3xl font-semibold">{stats.completed}</p>
        </Panel>
        <Panel className="border-emerald-300/25 bg-gradient-to-br from-emerald-500/15 to-teal-600/15">
          <div className="flex items-center justify-between text-emerald-100/90"><p className="text-xs">Pochons attendus</p><FlaskConical className="h-4 w-4" /></div>
          <p className="mt-3 text-3xl font-semibold">{stats.expected}</p>
        </Panel>
        <Panel className="border-rose-300/25 bg-gradient-to-br from-rose-500/15 to-red-600/15">
          <div className="flex items-center justify-between text-rose-100/90"><p className="text-xs">Pochons reçus</p><Beaker className="h-4 w-4" /></div>
          <p className="mt-3 text-3xl font-semibold">{stats.received}</p>
        </Panel>
      </div>

      <Panel className="grid gap-3 md:grid-cols-3">
        <div>
          <p className="mb-1 text-xs text-white/70">Prix vente pochon</p>
          <Input value={pouchSalePrice} onChange={(event) => setPouchSalePrice(Math.max(0, Number(event.target.value) || 0))} inputMode="decimal" />
        </div>
        <div>
          <p className="mb-1 text-xs text-white/70">Coût transfo brick (unité)</p>
          <Input value={brickTransformCost} onChange={(event) => setBrickTransformCost(Math.max(0, Number(event.target.value) || 0))} inputMode="decimal" />
        </div>
        <div>
          <p className="mb-1 text-xs text-white/70">Coût transfo pochon (lot de 10)</p>
          <Input value={pouchTransformCost} onChange={(event) => setPouchTransformCost(Math.max(0, Number(event.target.value) || 0))} inputMode="decimal" />
        </div>
        <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-sm">
          <p className="text-xs text-emerald-100/80">Total estimé (attendu)</p>
          <p className="text-lg font-semibold">{money(stats.expectedRevenue)}</p>
        </div>
        <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm">
          <p className="text-xs text-cyan-100/80">Total reçu</p>
          <p className="text-lg font-semibold">{money(stats.receivedRevenue)}</p>
        </div>
      </Panel>

      <div className="flex items-center justify-end">
        <PrimaryButton onClick={() => setCreating(true)} className="h-11 px-5">
          <Plus className="h-4 w-4" />
          Nouvelle demande
        </PrimaryButton>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Panel className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white/[0.03] text-left text-white/70">
                <tr>
                  <th className="px-3 py-3">Groupe</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Envoyé</th>
                  <th className="px-3 py-3">Attendu</th>
                  <th className="px-3 py-3">Reçu</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-3 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td className="px-3 py-8 text-center text-white/60" colSpan={7}>Chargement…</td></tr> : null}
                {!loading && rows.length === 0 ? <tr><td className="px-3 py-8 text-center text-white/60" colSpan={7}>Aucune demande.</td></tr> : null}
                {rows.map((row) => {
                  const active = row.id === selectedId
                  return (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedId(row.id)
                        }
                      }}
                      className={`border-t border-white/8 transition ${active ? 'bg-cyan-500/[0.12] shadow-[inset_0_0_35px_rgba(34,211,238,0.15)]' : 'hover:bg-white/[0.04]'}`}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 place-items-center rounded-full border border-cyan-300/30 bg-cyan-500/10 text-cyan-100"><Factory className="h-4 w-4" /></span>
                          <span className="font-medium text-white">{row.partner_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1 text-xs font-semibold text-white">{typeLabel(row.type)}</span>
                      </td>
                      <td className="px-3 py-3 font-medium">{row.quantity_sent}</td>
                      <td className="px-3 py-3 font-medium">{row.expected_output}</td>
                      <td className="px-3 py-3 font-medium">{row.received_output}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-white/70">{new Date(row.created_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className={`transition-all duration-300 ${selected ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-70'}`}>
          <h2 className="text-xl font-semibold text-white">Détails</h2>
          {!selected ? <p className="mt-4 text-sm text-white/65">Sélectionne une demande pour afficher les détails.</p> : (
            <div className="mt-4 space-y-3">
              <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm sm:grid-cols-2">
                <p><span className="text-white/60">Groupe :</span> <span className="font-semibold">{selected.partner_name}</span></p>
                <p><span className="text-white/60">Type :</span> <span className="font-semibold">{typeLabel(selected.type)}</span></p>
                <p><span className="text-white/60">Envoyé :</span> <span className="font-semibold">{selected.quantity_sent}</span></p>
                <p><span className="text-white/60">Attendu :</span> <span className="font-semibold">{selected.expected_output}</span></p>
                <p><span className="text-white/60">Reçu :</span> <span className="font-semibold">{selected.received_output}</span></p>
                <p><span className="text-white/60">Statut :</span> <span className="font-semibold">{statusLabel(selected.status)}</span></p>
              </div>

              <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/[0.08] p-3 text-sm text-cyan-100">
                {progress}% - Reste {remaining}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-sm">
                  <p className="text-xs text-white/65">Bricks nets estimés</p>
                  <p className="font-semibold">{Math.round(selectedFinance.brickCount)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-sm">
                  <p className="text-xs text-white/65">Total estimé vente</p>
                  <p className="font-semibold">{money(selectedFinance.revenue)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-sm">
                  <p className="text-xs text-white/65">Coût transfo total</p>
                  <p className="font-semibold">{money(selectedFinance.brickCost + selectedFinance.pouchCost)}</p>
                </div>
                <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-2.5 text-sm">
                  <p className="text-xs text-emerald-100/70">Bénéfice estimé</p>
                  <p className="font-semibold">{money(selectedFinance.estimatedProfit)}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/70">Reçu</label>
                <Input value={receivedInput} onChange={(event) => setReceivedInput(event.target.value)} inputMode="numeric" />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/70">Note</label>
                <textarea
                  value={noteInput}
                  onChange={(event) => setNoteInput(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/45"
                  placeholder="Notes / précision..."
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleUpdateSelected('validate')}
                  disabled={saving}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-4 font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Valider réception
                </button>
                <button
                  type="button"
                  onClick={() => void handleUpdateSelected('edit')}
                  disabled={saving}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-300/35 bg-amber-500/15 px-4 font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!selected) return
                    setSaving(true)
                    try {
                      const updated = await updateDrugProductionTracking(selected.id, { status: 'cancelled' })
                      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
                      toast.success('Demande annulée.')
                    } catch {
                      toast.error('Annulation impossible.')
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-300/35 bg-rose-500/15 px-4 font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Annuler
                </button>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {creating ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040916]/75 p-4 backdrop-blur-sm">
          <Panel className="w-full max-w-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">Nouvelle demande</h2>
              <SecondaryButton onClick={() => setCreating(false)} className="h-9 px-3">Fermer</SecondaryButton>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-white/70">Nom du groupe</label>
                <Input value={newRequest.partnerName} onChange={(event) => setNewRequest((prev) => ({ ...prev, partnerName: event.target.value }))} />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/70">Type</label>
                <GlassSelect
                  value={newRequest.type}
                  onChange={(value) => setNewRequest((prev) => ({ ...prev, type: value as ProductionType }))}
                  options={TYPE_OPTIONS}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/70">Quantité envoyée</label>
                <Input
                  value={newRequest.quantitySent}
                  onChange={(event) => setNewRequest((prev) => ({ ...prev, quantitySent: Number(event.target.value) || 0 }))}
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/70">Ratio transformation (1 → x)</label>
                <Input
                  value={newRequest.ratio}
                  onChange={(event) => setNewRequest((prev) => ({ ...prev, ratio: Number(event.target.value) || 0 }))}
                  inputMode="decimal"
                />
                <p className="text-[11px] text-white/55">Le ratio indique combien de feuilles finales tu obtiens pour 1 unité envoyée, avant la taxe brick de 5%.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/70">Attendu (auto)</label>
                <Input value={expectedFromForm} readOnly className="opacity-80" />
                <p className="text-[11px] text-white/55">
                  {Math.round(conversionFromForm.leaves)} feuilles → {Math.round(conversionFromForm.netBricks)} bricks (taxe 5%) → {conversionFromForm.pouches} pochons (1 brick = 10).
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/70">Date</label>
                <Input
                  type="date"
                  value={newRequest.createdAt}
                  onChange={(event) => setNewRequest((prev) => ({ ...prev, createdAt: event.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/70">Date estimée retour</label>
                <Input
                  type="date"
                  value={newRequest.expectedDate}
                  onChange={(event) => setNewRequest((prev) => ({ ...prev, expectedDate: event.target.value }))}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-white/70">Note</label>
                <textarea
                  value={newRequest.note}
                  onChange={(event) => setNewRequest((prev) => ({ ...prev, note: event.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/45"
                  placeholder="Précisions / contact partenaire..."
                />
              </div>

              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/[0.07] p-3 sm:col-span-2">
                <p className="mb-2 text-sm font-semibold text-cyan-100">Prix & estimation</p>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/15 bg-white/[0.05]">
                        {assetImages.pouch ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={assetImages.pouch} alt="Pochon" className="h-full w-full object-cover" />
                        ) : <div className="grid h-full w-full place-items-center text-white/60"><Sparkles className="h-4 w-4" /></div>}
                      </div>
                      <p className="text-xs text-white/70">Prix vente pochon</p>
                    </div>
                    <Input value={pouchSalePrice} onChange={(event) => setPouchSalePrice(Math.max(0, Number(event.target.value) || 0))} inputMode="decimal" />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/15 bg-white/[0.05]">
                        {assetImages.brick ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={assetImages.brick} alt="Brick" className="h-full w-full object-cover" />
                        ) : <div className="grid h-full w-full place-items-center text-white/60"><ReceiptText className="h-4 w-4" /></div>}
                      </div>
                      <p className="text-xs text-white/70">Coût transfo brick</p>
                    </div>
                    <Input value={brickTransformCost} onChange={(event) => setBrickTransformCost(Math.max(0, Number(event.target.value) || 0))} inputMode="decimal" />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/15 bg-white/[0.05]">
                        {assetImages.leaf ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={assetImages.leaf} alt="Feuille" className="h-full w-full object-cover" />
                        ) : <div className="grid h-full w-full place-items-center text-white/60"><Coins className="h-4 w-4" /></div>}
                      </div>
                      <p className="text-xs text-white/70">Coût transfo pochon (lot)</p>
                    </div>
                    <Input value={pouchTransformCost} onChange={(event) => setPouchTransformCost(Math.max(0, Number(event.target.value) || 0))} inputMode="decimal" />
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-2 text-xs">
                    <p className="text-emerald-100/80">Total vente estimé</p>
                    <p className="text-base font-semibold">{money(conversionFromForm.pouches * pouchSalePrice)}</p>
                  </div>
                  <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-2 text-xs">
                    <p className="text-amber-100/80">Coût transfo total</p>
                    <p className="text-base font-semibold">{money((conversionFromForm.netBricks * brickTransformCost) + ((conversionFromForm.pouches / POUCH_BATCH_SIZE) * pouchTransformCost))}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-2 text-xs">
                    <p className="text-cyan-100/80">Bénéfice estimé</p>
                    <p className="text-base font-semibold">{money((conversionFromForm.pouches * pouchSalePrice) - ((conversionFromForm.netBricks * brickTransformCost) + ((conversionFromForm.pouches / POUCH_BATCH_SIZE) * pouchTransformCost)))}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <PrimaryButton onClick={() => void handleCreateRequest()} disabled={saving} className="h-10 px-4">
                <Plus className="h-4 w-4" />
                Créer la demande
              </PrimaryButton>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  )
}
