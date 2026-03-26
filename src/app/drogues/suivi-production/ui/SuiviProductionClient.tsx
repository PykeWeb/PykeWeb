'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, Beaker, CalendarClock, CalendarDays, CheckCircle2, Clock3, Coins, Factory, FlaskConical, NotebookPen, Package, Plus, ReceiptText, Save, Sparkles, Sprout, Tags, User } from 'lucide-react'
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
  flowMode: 'full_chain' as FlowMode,
  seedQty: 100,
  leafQty: 100,
  brickQty: 95,
  createdAt: new Date().toISOString().slice(0, 10),
  expectedDate: '',
  note: '',
}

type FlowMode = 'seed_only' | 'leaf_to_brick' | 'brick_to_pouch' | 'full_chain'

const BRICK_TAX_PERCENT = 5
const POUCHES_PER_BRICK = 10
const POUCH_BATCH_SIZE = 10

const FLOW_OPTIONS: { value: FlowMode; label: string }[] = [
  { value: 'seed_only', label: 'Achat graines' },
  { value: 'leaf_to_brick', label: 'Feuille → Brick' },
  { value: 'brick_to_pouch', label: 'Brick → Pochon' },
  { value: 'full_chain', label: 'Les 3 étapes' },
]

const FLOW_META: Record<FlowMode, { icon: typeof Sprout; description: string }> = {
  seed_only: { icon: Sprout, description: 'Achat simple de graines' },
  leaf_to_brick: { icon: ArrowRightLeft, description: 'Transformer feuilles en bricks' },
  brick_to_pouch: { icon: Package, description: 'Transformer bricks en pochons' },
  full_chain: { icon: Sparkles, description: 'Graines → Bricks → Pochons' },
}

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
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [pouchSalePrice, setPouchSalePrice] = useState(0)
  const [seedPrice, setSeedPrice] = useState(0)
  const [brickTransformCost, setBrickTransformCost] = useState(0)
  const [pouchTransformCost, setPouchTransformCost] = useState(0)
  const [assetImages, setAssetImages] = useState<{ pouch: string | null; brick: string | null; leaf: string | null }>({ pouch: null, brick: null, leaf: null })
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all')

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  )

  const visibleRows = useMemo(() => {
    if (statusFilter === 'all') return rows
    return rows.filter((row) => row.status === statusFilter)
  }, [rows, statusFilter])

  const expectedFromForm = useMemo(() => {
    const baseLeaves = newRequest.flowMode === 'full_chain'
      ? Math.max(0, Number(newRequest.seedQty || 0))
      : Math.max(0, Number(newRequest.leafQty || 0))
    const netBricks = newRequest.flowMode === 'brick_to_pouch'
      ? Math.max(0, Number(newRequest.brickQty || 0))
      : Math.floor(baseLeaves * (1 - BRICK_TAX_PERCENT / 100))
    if (newRequest.flowMode === 'seed_only') return Math.max(0, Number(newRequest.seedQty || 0))
    if (newRequest.flowMode === 'leaf_to_brick') return Math.max(0, netBricks)
    return Math.max(0, netBricks * POUCHES_PER_BRICK)
  }, [newRequest.brickQty, newRequest.flowMode, newRequest.leafQty, newRequest.seedQty])

  const conversionFromForm = useMemo(() => {
    const seedQty = Math.max(0, Number(newRequest.seedQty || 0))
    const leaves = newRequest.flowMode === 'full_chain'
      ? seedQty
      : newRequest.flowMode === 'leaf_to_brick'
        ? Math.max(0, Number(newRequest.leafQty || 0))
        : 0
    const netBricks = newRequest.flowMode === 'brick_to_pouch'
      ? Math.max(0, Number(newRequest.brickQty || 0))
      : Math.floor(leaves * (1 - BRICK_TAX_PERCENT / 100))
    const pouches = Math.max(0, Math.floor(netBricks * POUCHES_PER_BRICK))
    return { seedQty, leaves, netBricks, pouches }
  }, [newRequest.brickQty, newRequest.flowMode, newRequest.leafQty, newRequest.seedQty])

  const stats = useMemo(() => {
    const inProgress = rows.filter((r) => r.status === 'in_progress').length
    const completed = rows.filter((r) => r.status === 'completed').length
    const expected = rows.reduce((sum, r) => sum + Number(r.expected_output || 0), 0)
    const received = rows.reduce((sum, r) => sum + Number(r.received_output || 0), 0)
    const expectedRevenue = expected * pouchSalePrice
    const receivedRevenue = received * pouchSalePrice
    return { inProgress, completed, expected, received, expectedRevenue, receivedRevenue }
  }, [rows, pouchSalePrice])

  const partnerStats = useMemo(() => {
    const counts = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.partner_name || 'Inconnu'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return {
      uniquePartners: entries.length,
      topPartner: entries[0]?.[0] || '—',
      topPartnerCount: entries[0]?.[1] || 0,
    }
  }, [rows])

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const data = await listDrugProductionTrackings()
        if (!mounted) return
        setRows(data)
        if (data.length > 0) {
          setSelectedId(data[0].id)
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
        const seed = items.find((item) => normalize(item.name).includes('graine'))
        if (pouch) {
          setPouchSalePrice(Math.max(0, Number(pouch.sell_price || pouch.buy_price || 0)))
        }
        if (seed) {
          setSeedPrice(Math.max(0, Number(seed.buy_price || seed.sell_price || 0)))
        }
        setAssetImages({
          pouch: pouch?.image_url || null,
          brick: brick?.image_url || null,
          leaf: leaf?.image_url || null,
        })
      })
      .catch(() => undefined)
  }, [])

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
    if (!selected) return { brickCount: 0, seedCost: 0, pouchCost: 0, brickCost: 0, revenue: 0, estimatedProfit: 0 }
    const brickCount = selected.expected_output / POUCHES_PER_BRICK
    const revenue = selected.expected_output * pouchSalePrice
    const seedCost = selected.quantity_sent * seedPrice
    const brickCost = brickCount * brickTransformCost
    const pouchCost = (selected.expected_output / POUCH_BATCH_SIZE) * pouchTransformCost
    return {
      brickCount,
      seedCost,
      brickCost,
      pouchCost,
      revenue,
      estimatedProfit: revenue - seedCost - brickCost - pouchCost,
    }
  }, [brickTransformCost, pouchSalePrice, pouchTransformCost, seedPrice, selected])

  async function handleCreateRequest() {
    if (!newRequest.partnerName.trim()) {
      toast.error('Le nom du groupe est obligatoire.')
      return
    }

    const quantitySent = newRequest.flowMode === 'seed_only' || newRequest.flowMode === 'full_chain'
      ? Math.max(0, Number(newRequest.seedQty || 0))
      : newRequest.flowMode === 'leaf_to_brick'
        ? Math.max(0, Number(newRequest.leafQty || 0))
        : Math.max(0, Number(newRequest.brickQty || 0))

    const flowLabel =
      newRequest.flowMode === 'seed_only' ? 'Achat graines'
        : newRequest.flowMode === 'leaf_to_brick' ? 'Feuille->Brick'
          : newRequest.flowMode === 'brick_to_pouch' ? 'Brick->Pochon'
            : 'Les 3 étapes'

    setSaving(true)
    try {
      const created = await createDrugProductionTracking({
        partnerName: newRequest.partnerName.trim(),
        type: newRequest.type,
        quantitySent,
        ratio: 1,
        expectedOutput: expectedFromForm,
        note: `[${flowLabel}] ${newRequest.note || ''}`.trim(),
        expectedDate: newRequest.expectedDate || undefined,
      })
      setRows((prev) => [created, ...prev])
      setSelectedId(created.id)
      setCreating(false)
      setNewRequest(NEW_REQUEST_INITIAL)
      setNoteExpanded(false)
      toast.success('Demande de production créée.')
    } catch (error: unknown) {
      try {
        const created = await createDrugProductionTracking({
          partnerName: newRequest.partnerName.trim(),
          type: newRequest.type,
          quantitySent,
          ratio: 1,
          expectedOutput: expectedFromForm,
          note: newRequest.note?.trim() || undefined,
        })
        setRows((prev) => [created, ...prev])
        setSelectedId(created.id)
        setCreating(false)
        setNewRequest(NEW_REQUEST_INITIAL)
        setNoteExpanded(false)
        toast.success('Demande créée (mode compatibilité).')
      } catch (retryError: unknown) {
        const message = retryError instanceof Error ? retryError.message : (error instanceof Error ? error.message : 'Impossible de créer la demande.')
        const draftId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `draft-${Date.now()}`
        const draft: DrugProductionTrackingRow = {
          id: draftId,
          group_id: 'local-draft',
          partner_name: newRequest.partnerName.trim(),
          type: newRequest.type,
          quantity_sent: quantitySent,
          ratio: 1,
          expected_output: expectedFromForm,
          received_output: 0,
          status: 'in_progress',
          note: `[BROUILLON LOCAL] ${newRequest.note || ''}`.trim() || null,
          created_at: new Date().toISOString(),
          expected_date: /^\d{4}-\d{2}-\d{2}$/.test(newRequest.expectedDate || '') ? newRequest.expectedDate : null,
        }
        setRows((prev) => [draft, ...prev])
        setSelectedId(draft.id)
        setCreating(false)
        setNewRequest(NEW_REQUEST_INITIAL)
        setNoteExpanded(false)
        toast.error(`${message} • Demande gardée en brouillon local.`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Suivi Production" subtitle="Suivi des transformations externes (coke, meth...)" />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <button type="button" onClick={() => setStatusFilter('in_progress')} className={`rounded-2xl border px-4 py-3 text-left ${statusFilter === 'in_progress' ? 'border-sky-200/60 bg-gradient-to-br from-sky-500/30 to-blue-600/20' : 'border-sky-300/25 bg-gradient-to-br from-sky-500/15 to-blue-600/15'}`}>
          <div className="flex items-center justify-between text-sky-100/90"><p className="text-xs">Total en cours</p><Clock3 className="h-4 w-4" /></div>
          <p className="mt-3 text-3xl font-semibold">{stats.inProgress}</p>
        </button>
        <button type="button" onClick={() => setStatusFilter('completed')} className={`rounded-2xl border px-4 py-3 text-left ${statusFilter === 'completed' ? 'border-violet-200/60 bg-gradient-to-br from-violet-500/30 to-fuchsia-600/20' : 'border-violet-300/25 bg-gradient-to-br from-violet-500/15 to-fuchsia-600/15'}`}>
          <div className="flex items-center justify-between text-violet-100/90"><p className="text-xs">Total terminé</p><CheckCircle2 className="h-4 w-4" /></div>
          <p className="mt-3 text-3xl font-semibold">{stats.completed}</p>
        </button>
        <button type="button" onClick={() => setStatusFilter('all')} className={`rounded-2xl border px-4 py-3 text-left ${statusFilter === 'all' ? 'border-emerald-200/60 bg-gradient-to-br from-emerald-500/30 to-teal-600/20' : 'border-emerald-300/25 bg-gradient-to-br from-emerald-500/15 to-teal-600/15'}`}>
          <div className="flex items-center justify-between text-emerald-100/90"><p className="text-xs">Pochons attendus</p><FlaskConical className="h-4 w-4" /></div>
          <p className="mt-3 text-3xl font-semibold">{stats.expected}</p>
        </button>
        <button type="button" onClick={() => setStatusFilter('all')} className="rounded-2xl border border-rose-300/25 bg-gradient-to-br from-rose-500/15 to-red-600/15 px-4 py-3 text-left">
          <div className="flex items-center justify-between text-rose-100/90"><p className="text-xs">Pochons reçus</p><Beaker className="h-4 w-4" /></div>
          <p className="mt-3 text-3xl font-semibold">{stats.received}</p>
        </button>
        <button type="button" onClick={() => setStatusFilter('all')} className="rounded-xl border border-violet-300/25 bg-violet-500/10 p-3 text-left text-sm">
          <p className="text-xs text-violet-100/80">Partenaires utilisés</p>
          <p className="text-lg font-semibold">{partnerStats.uniquePartners}</p>
          <p className="mt-1 text-xs text-violet-100/80">Top: {partnerStats.topPartner} ({partnerStats.topPartnerCount})</p>
        </button>
      </div>

      <div className="flex items-center justify-end">
        <PrimaryButton onClick={() => { setNoteExpanded(false); setCreating(true) }} className="h-11 px-5">
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
                {!loading && visibleRows.length === 0 ? <tr><td className="px-3 py-8 text-center text-white/60" colSpan={7}>Aucune demande.</td></tr> : null}
                {visibleRows.map((row) => {
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
                  <p className="font-semibold">{money(selectedFinance.seedCost + selectedFinance.brickCost + selectedFinance.pouchCost)}</p>
                </div>
                <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-2.5 text-sm">
                  <p className="text-xs text-emerald-100/70">Bénéfice estimé</p>
                  <p className="font-semibold">{money(selectedFinance.estimatedProfit)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70">
                Vue lecture seule. Clique sur “Ouvrir modification” pour éditer cette transaction.
              </div>
              <Link href={`/drogues/suivi-production/${selected.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-300/35 bg-amber-500/15 px-4 font-semibold text-amber-100 transition hover:bg-amber-500/25">
                <Save className="h-4 w-4" />
                Ouvrir modification
              </Link>
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
              <div className="space-y-1 rounded-xl border border-cyan-300/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/[0.08] p-2.5 sm:col-span-2">
                <label className="flex items-center gap-1.5 text-xs text-cyan-100/80"><User className="h-3.5 w-3.5" /> Nom du groupe</label>
                <Input value={newRequest.partnerName} onChange={(event) => setNewRequest((prev) => ({ ...prev, partnerName: event.target.value }))} />
              </div>

              <div className="space-y-1 rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-500/10 to-indigo-500/[0.08] p-2.5">
                <label className="flex items-center gap-1.5 text-xs text-violet-100/80"><Tags className="h-3.5 w-3.5" /> Type</label>
                <GlassSelect
                  value={newRequest.type}
                  onChange={(value) => setNewRequest((prev) => ({ ...prev, type: value as ProductionType }))}
                  options={TYPE_OPTIONS}
                />
              </div>

              <div className="space-y-1 rounded-xl border border-emerald-300/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/[0.08] p-2.5 sm:col-span-2">
                <label className="flex items-center gap-1.5 text-xs text-emerald-100/80"><Sparkles className="h-3.5 w-3.5" /> Mode opération</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FLOW_OPTIONS.map((option) => {
                    const meta = FLOW_META[option.value]
                    const Icon = meta.icon
                    const active = newRequest.flowMode === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setNewRequest((prev) => ({ ...prev, flowMode: option.value }))}
                        className={`rounded-xl border px-3 py-2 text-left transition ${active ? 'border-cyan-100/70 bg-gradient-to-br from-cyan-500/25 to-blue-500/20 shadow-[0_0_24px_rgba(34,211,238,0.3)]' : 'border-white/12 bg-white/[0.03] hover:bg-white/[0.06]'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/15 bg-white/[0.04] text-white/85"><Icon className="h-4 w-4" /></span>
                          <div>
                            <p className="text-sm font-semibold text-white">{option.label}</p>
                            <p className="text-[11px] text-white/60">{meta.description}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {newRequest.flowMode === 'seed_only' || newRequest.flowMode === 'full_chain' ? (
                <div className="space-y-1 rounded-xl border border-emerald-300/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/[0.07] p-2.5">
                  <label className="flex items-center gap-1.5 text-xs text-emerald-100/80"><Sprout className="h-3.5 w-3.5" /> Quantité graines</label>
                  <Input
                    value={newRequest.seedQty}
                    onChange={(event) => setNewRequest((prev) => ({ ...prev, seedQty: Number(event.target.value) || 0 }))}
                    inputMode="numeric"
                  />
                </div>
              ) : null}

              {newRequest.flowMode === 'leaf_to_brick' ? (
                <div className="space-y-1 rounded-xl border border-emerald-300/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/[0.07] p-2.5">
                  <label className="flex items-center gap-1.5 text-xs text-emerald-100/80"><Sprout className="h-3.5 w-3.5" /> Quantité feuilles</label>
                  <Input
                    value={newRequest.leafQty}
                    onChange={(event) => setNewRequest((prev) => ({ ...prev, leafQty: Number(event.target.value) || 0 }))}
                    inputMode="numeric"
                  />
                </div>
              ) : null}

              {newRequest.flowMode === 'brick_to_pouch' ? (
                <div className="space-y-1 rounded-xl border border-emerald-300/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/[0.07] p-2.5">
                  <label className="flex items-center gap-1.5 text-xs text-emerald-100/80"><Package className="h-3.5 w-3.5" /> Quantité bricks</label>
                  <Input
                    value={newRequest.brickQty}
                    onChange={(event) => setNewRequest((prev) => ({ ...prev, brickQty: Number(event.target.value) || 0 }))}
                    inputMode="numeric"
                  />
                </div>
              ) : null}

              <div className="space-y-1 rounded-xl border border-cyan-300/25 bg-gradient-to-br from-cyan-500/12 to-blue-500/[0.09] p-2.5">
                <label className="flex items-center gap-1.5 text-xs text-cyan-100/80"><Beaker className="h-3.5 w-3.5" /> Attendu (auto)</label>
                <Input value={expectedFromForm} readOnly className="opacity-80" />
                <p className="text-[11px] text-white/55">
                  {newRequest.flowMode === 'seed_only'
                    ? `${conversionFromForm.seedQty} graines achetées.`
                    : newRequest.flowMode === 'leaf_to_brick'
                      ? `${Math.round(conversionFromForm.leaves)} feuilles → ${Math.round(conversionFromForm.netBricks)} bricks (taxe 5%).`
                      : newRequest.flowMode === 'brick_to_pouch'
                        ? `${Math.round(conversionFromForm.netBricks)} bricks → ${conversionFromForm.pouches} pochons (1 brick = 10).`
                        : `${conversionFromForm.seedQty} graines → ${Math.round(conversionFromForm.netBricks)} bricks (taxe 5%) → ${conversionFromForm.pouches} pochons.`}
                </p>
              </div>

              <div className="space-y-1 rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-500/10 to-indigo-500/[0.08] p-2.5">
                <label className="flex items-center gap-1.5 text-xs text-violet-100/80"><CalendarDays className="h-3.5 w-3.5" /> Date</label>
                <Input
                  type="date"
                  value={newRequest.createdAt}
                  onChange={(event) => setNewRequest((prev) => ({ ...prev, createdAt: event.target.value }))}
                />
              </div>

              <div className="space-y-1 rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-500/10 to-indigo-500/[0.08] p-2.5">
                <label className="flex items-center gap-1.5 text-xs text-violet-100/80"><CalendarClock className="h-3.5 w-3.5" /> Date estimée retour</label>
                <Input
                  type="date"
                  value={newRequest.expectedDate}
                  onChange={(event) => setNewRequest((prev) => ({ ...prev, expectedDate: event.target.value }))}
                />
              </div>

              <div className="space-y-1 rounded-xl border border-amber-300/20 bg-gradient-to-br from-amber-500/10 to-orange-500/[0.08] p-2.5 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setNoteExpanded((prev) => !prev)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${noteExpanded ? 'border-amber-200/45 bg-amber-500/15' : 'border-white/12 bg-white/[0.03] hover:bg-white/[0.06]'}`}
                >
                  <span className="flex items-center gap-1.5 text-xs text-amber-100/90"><NotebookPen className="h-3.5 w-3.5" /> Note (optionnel) — {noteExpanded ? 'Masquer' : 'Ajouter'}</span>
                </button>
                {noteExpanded ? (
                  <textarea
                    value={newRequest.note}
                    onChange={(event) => setNewRequest((prev) => ({ ...prev, note: event.target.value }))}
                    rows={3}
                    className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/45"
                    placeholder="Précisions / contact partenaire..."
                  />
                ) : null}
              </div>

              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/[0.07] p-3 sm:col-span-2">
                <p className="mb-2 text-sm font-semibold text-cyan-100">Prix & estimation</p>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/15 bg-white/[0.05]">
                        {assetImages.leaf ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={assetImages.leaf} alt="Graine" className="h-full w-full object-cover" />
                        ) : <div className="grid h-full w-full place-items-center text-white/60"><Sprout className="h-4 w-4" /></div>}
                      </div>
                      <p className="text-xs text-white/70">Prix graine</p>
                    </div>
                    <Input value={seedPrice} onChange={(event) => setSeedPrice(Math.max(0, Number(event.target.value) || 0))} inputMode="decimal" />
                  </div>
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
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-2 text-xs">
                    <p className="text-amber-100/80">Coût graines</p>
                    <p className="text-base font-semibold">{money(conversionFromForm.seedQty * seedPrice)}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-2 text-xs">
                    <p className="text-emerald-100/80">Total vente estimé</p>
                    <p className="text-base font-semibold">{money(conversionFromForm.pouches * pouchSalePrice)}</p>
                  </div>
                  <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-2 text-xs">
                    <p className="text-amber-100/80">Coût transfo total</p>
                    <p className="text-base font-semibold">{money((conversionFromForm.seedQty * seedPrice) + (conversionFromForm.netBricks * brickTransformCost) + ((conversionFromForm.pouches / POUCH_BATCH_SIZE) * pouchTransformCost))}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-2 text-xs">
                    <p className="text-cyan-100/80">Bénéfice estimé</p>
                    <p className="text-base font-semibold">{money((conversionFromForm.pouches * pouchSalePrice) - ((conversionFromForm.seedQty * seedPrice) + (conversionFromForm.netBricks * brickTransformCost) + ((conversionFromForm.pouches / POUCH_BATCH_SIZE) * pouchTransformCost)))}</p>
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
