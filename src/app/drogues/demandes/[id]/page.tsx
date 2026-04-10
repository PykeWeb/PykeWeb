'use client'

import Link from 'next/link'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Beaker, CalendarClock, CheckCircle2, Coins, Factory, FlaskConical, NotebookPen, Package, PencilLine, User2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { DemandePartenaireForm, type DemandFormValue } from '@/components/modules/drogues/DemandePartenaireForm'
import { adjustDrugStock, listDrugItems } from '@/lib/drugsApi'
import { deleteDrugProductionTracking, listDrugProductionTrackings, updateDrugProductionTracking, type DrugProductionTrackingRow } from '@/lib/drugProductionTrackingApi'
import { toDrugShortLabel } from '@/lib/drugLabels'

function parseTransfoMeta(note: string | null | undefined) {
  const raw = String(note || '').trim()
  if (!raw.startsWith('[transfo:v2]')) return null
  try {
    return JSON.parse(raw.slice('[transfo:v2]'.length)) as { sentQty?: number; tableQty?: number; imageUrl?: string | null; receivedMoney?: number }
  } catch {
    return null
  }
}

function parseUserNote(note: string | null | undefined) {
  const meta = parseTransfoMeta(note)
  if (meta && typeof (meta as { note?: unknown }).note === 'string') return (meta as { note: string }).note
  const raw = String(note || '').trim()
  if (raw.startsWith('[transfo:v2]')) return ''
  return raw
}

function normalizedTypeToken(rawType: string) {
  const value = String(rawType || '').toLowerCase()
  if (value.includes('coke')) return 'coke'
  if (value.includes('meth')) return 'meth'
  return ''
}

async function findPouchItemId(rawType: string) {
  const token = normalizedTypeToken(rawType)
  const items = await listDrugItems()
  const pouches = items.filter((item) => {
    const name = (item.name || '').toLowerCase()
    return name.includes('pochon') || name.includes('pouch') || name.includes('sachet')
  })
  if (!token) return pouches[0]?.id || null
  return pouches.find((item) => (item.name || '').toLowerCase().includes(token))?.id || pouches[0]?.id || null
}

export default function DemandeDetailPage() {
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const router = useRouter()
  const editMode = search.get('mode') === 'edit'
  const [row, setRow] = useState<DrugProductionTrackingRow | null>(null)

  useEffect(() => { void listDrugProductionTrackings().then((r) => setRow(r.find((x) => x.id === params.id) || null)).catch(() => setRow(null)) }, [params.id])

  const remaining = useMemo(() => row ? Math.max(0, row.expected_output - row.received_output) : 0, [row])

  async function onUpdate(value: DemandFormValue, expectedOutput: number) {
    if (!row) return
    const nextStatus = row.received_output >= expectedOutput ? 'completed' : 'in_progress'
    const quantitySent = value.type === 'meth'
      ? value.quantityLeaves
      : value.mode === 'brick_to_pouch'
        ? value.quantityBricks
        : value.quantityLeaves
    const updated = await updateDrugProductionTracking(row.id, {
      partnerName: value.partnerName,
      type: value.type,
      quantitySent,
      expectedOutput,
      note: `[transfo:v2]${JSON.stringify({ mode: value.mode, sentQty: value.type === 'meth' ? value.quantityLeaves : quantitySent, tableQty: value.type === 'meth' ? value.quantitySeeds : undefined, imageUrl: parseTransfoMeta(row.note)?.imageUrl || null, note: value.note || '', receivedMoney: Number(parseTransfoMeta(row.note)?.receivedMoney || 0) })}`,
      expectedDate: value.expectedDate || null,
      createdAt: value.createdAt,
      seedPrice: value.seedPrice,
      pouchSalePrice: value.pouchSalePrice,
      brickTransformCost: value.brickTransformCost,
      pouchTransformCost: value.pouchTransformCost,
      status: nextStatus,
    })
    setRow(updated)
    toast.success('Transaction mise à jour.')
    router.replace(`/drogues/demandes/${row.id}`)
  }

  if (!row) return <Panel>Transaction introuvable.</Panel>

  return (
    <div className="space-y-7 pb-6">
      <PageHeader title="Détail demande" subtitle="Suivi détaillé d'une transaction partenaire" />
      <Link href="/drogues/suivi-production" className="inline-flex items-center gap-1.5 text-sm text-cyan-100"><ArrowLeft className="h-4 w-4" />Retour suivi</Link>

      {editMode ? (
        <Panel className="space-y-5 p-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/65">Édition</p>
            <p className="mt-1 text-sm text-white/75">Les sections sont regroupées pour faciliter la lecture tablette/FiveM.</p>
          </div>
          <DemandePartenaireForm
            initial={{ partnerName: row.partner_name, type: row.type, mode: row.type === 'meth' ? 'tables_purchase' : 'leaf_to_pouch', createdAt: row.created_at.slice(0, 10), quantitySeeds: Number(parseTransfoMeta(row.note)?.tableQty ?? row.quantity_sent), quantityLeaves: Number(parseTransfoMeta(row.note)?.sentQty ?? row.quantity_sent), quantityBricks: row.type === 'meth' ? Number(row.expected_output || 0) : Math.floor(row.expected_output / 10), seedPrice: Number(row.seed_price || 0), pouchSalePrice: Number(row.pouch_sale_price || 0), brickTransformCost: Number(row.brick_transform_cost || 0), pouchTransformCost: Number(row.pouch_transform_cost || 0), note: parseUserNote(row.note), expectedDate: row.expected_date || '' }}
            submitLabel="Modifier"
            onSubmit={onUpdate}
            onCancel={() => router.replace(`/drogues/demandes/${row.id}`)}
          />
        </Panel>
      ) : (
        <Panel className="space-y-5 p-5">
          {parseTransfoMeta(row.note)?.imageUrl ? (
            <div className="overflow-hidden rounded-xl border border-white/15 bg-white/[0.03] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={parseTransfoMeta(row.note)?.imageUrl || ''} alt="Image demande" className="max-h-72 w-full rounded-lg object-cover" />
            </div>
          ) : null}
          <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
            <p className="inline-flex items-center gap-1.5"><User2 className="h-3.5 w-3.5 text-white/60" />Groupe: <b>{row.partner_name}</b></p><p className="inline-flex items-center gap-1.5">{String(row.type || '').toLowerCase().includes('meth') ? <FlaskConical className="h-3.5 w-3.5 text-fuchsia-200" /> : <Beaker className="h-3.5 w-3.5 text-sky-200" />}Type: <b>{toDrugShortLabel(String(row.type))}</b></p>
            <p className="inline-flex items-center gap-1.5"><Factory className="h-3.5 w-3.5 text-white/60" />Envoyé: <b>{parseTransfoMeta(row.note)?.sentQty ?? row.quantity_sent}</b></p><p className="inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-white/60" />Attendu: <b>{row.expected_output}</b></p>
            <p className="inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-cyan-200" />Reçu: <b>{row.received_output}</b></p><p className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-white/60" />Date: <b>{new Date(row.created_at).toLocaleDateString('fr-FR')}</b></p>
            <p>Argent reçu: <b>{Math.max(0, Number(parseTransfoMeta(row.note)?.receivedMoney || 0))} $</b></p>
            <p>Date retour: <b>{row.expected_date || '—'}</b></p><p>Statut: <b>{row.status}</b></p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3">{Math.round((row.received_output / Math.max(1, row.expected_output)) * 100)}% reçu - reste {remaining}</div>
            <div className="rounded-xl border border-violet-300/25 bg-violet-500/10 p-3">
              <p className="inline-flex items-center gap-1.5 text-xs text-violet-100/80"><Coins className="h-3.5 w-3.5" />Résumé économique</p>
              <p className="mt-1 text-sm text-violet-100">Revente estimée: <b>{Math.round(Number(row.expected_output || 0) * Number(row.pouch_sale_price || 0))} $</b></p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-300/20 bg-amber-500/[0.06] p-3">
            <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-100/85"><NotebookPen className="h-3.5 w-3.5" />Note utilisateur</p>
            <p className="text-sm text-white/80">{parseUserNote(row.note) || 'Aucune note utilisateur.'}</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={async () => {
              try {
                const pouchId = await findPouchItemId(String(row.type))
                if (!pouchId) {
                  toast.error('Aucun item pochon trouvé pour cette drogue.')
                  return
                }
                await adjustDrugStock({ itemId: pouchId, delta: row.expected_output, note: `Entrée auto livrée ${row.id} (${row.partner_name})` })
                const u = await updateDrugProductionTracking(row.id, { receivedOutput: row.expected_output, status: 'completed' })
                setRow(u)
                toast.success('Livraison validée et stock mis à jour.')
              } catch (error: unknown) {
                toast.error(error instanceof Error ? error.message : 'Erreur livraison.')
              }
            }} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 font-semibold text-emerald-100"><CheckCircle2 className="h-4 w-4" />Livrée</button>
            <Link href={`/drogues/demandes/${row.id}?mode=edit`} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/35 bg-amber-500/15 px-4 py-2 font-semibold text-amber-100"><PencilLine className="h-4 w-4" />Modifier</Link>
            <button onClick={async () => { const u = await updateDrugProductionTracking(row.id, { status: 'cancelled' }); setRow(u) }} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300/35 bg-rose-500/15 px-4 py-2 font-semibold text-rose-100"><XCircle className="h-4 w-4" />Annuler</button>
            <button onClick={async () => { try { await deleteDrugProductionTracking(row.id); toast.success('Transaction supprimée.'); router.replace('/drogues/suivi-production') } catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Suppression impossible.') } }} className="rounded-xl border border-red-300/35 bg-red-500/15 px-4 py-2 font-semibold text-red-100">Supprimer</button>
            <Link href="/drogues/suivi-production" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-semibold text-white">Retour</Link>
          </div>
        </Panel>
      )}
    </div>
  )
}
