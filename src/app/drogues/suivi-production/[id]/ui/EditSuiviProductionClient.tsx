'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Ban, CheckCircle2, Clock3, PackageCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { SecondaryButton } from '@/components/ui/design-system'
import { DemandePartenaireForm, type DemandFormValue } from '@/components/modules/drogues/DemandePartenaireForm'
import { deleteDrugProductionTracking, listDrugProductionTrackings, updateDrugProductionTracking, type DrugProductionTrackingRow } from '@/lib/drugProductionTrackingApi'

function inferDemandMode(note: string | null | undefined): DemandFormValue['mode'] {
  const raw = String(note || '').toLowerCase()
  if (raw.includes('feuille->brick')) return 'leaf_to_brick'
  if (raw.includes('brick->pochon')) return 'brick_to_pouch'
  if (raw.includes('feuille->pochon')) return 'leaf_to_pouch'
  if (raw.includes('meth') || raw.includes('table')) return 'machine_transform'
  return 'leaf_to_pouch'
}

function isMethType(rawType: string) {
  return String(rawType || '').toLowerCase().includes('meth')
}

function normalizeDemandType(rawType: string): DemandFormValue['type'] {
  if (isMethType(rawType)) return 'meth'
  if (String(rawType || '').toLowerCase().includes('coke')) return 'coke'
  return 'other'
}

export default function EditSuiviProductionClient({ id }: { id: string }) {
  const router = useRouter()
  const [row, setRow] = useState<DrugProductionTrackingRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [receivedDraft, setReceivedDraft] = useState('0')

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listDrugProductionTrackings()
        const found = rows.find((entry) => entry.id === id) || null
        setRow(found)
        setReceivedDraft(String(Math.max(0, Number(found?.received_output || 0))))
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'Impossible de charger la transaction.')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  async function onSubmit(value: DemandFormValue, expectedOutput: number) {
    if (!row) return
    const nextReceived = Math.max(0, Number(receivedDraft || row.received_output || 0))
    const status = nextReceived >= expectedOutput ? 'completed' : 'in_progress'
    const nextQuantitySent = isMethType(row.type)
      ? Math.max(0, Number(value.quantityLeaves || 0))
      : (value.mode === 'brick_to_pouch'
        ? Math.max(0, Number(value.quantityBricks || 0))
        : value.mode === 'leaf_to_brick' || value.mode === 'leaf_to_pouch'
          ? Math.max(0, Number(value.quantityLeaves || 0))
          : Math.max(0, Number(value.quantitySeeds || 0)))
    const updated = await updateDrugProductionTracking(row.id, {
      note: `[${value.mode}] ${value.note || ''}`.trim(),
      quantitySent: nextQuantitySent,
      expectedOutput,
      seedPrice: value.seedPrice,
      pouchSalePrice: value.pouchSalePrice,
      brickTransformCost: value.brickTransformCost,
      pouchTransformCost: value.pouchTransformCost,
      receivedOutput: nextReceived,
      status,
    })
    setRow(updated)
    toast.success('Transaction modifiée.')
    router.replace('/drogues/suivi-production')
  }

  async function quickStatus(action: 'received' | 'completed' | 'in_progress' | 'cancelled') {
    if (!row) return
    try {
      if (action === 'received') {
        const updated = await updateDrugProductionTracking(row.id, {
          receivedOutput: row.expected_output,
          status: 'completed',
        })
        setRow(updated)
        toast.success('Statut: Reçu.')
        return
      }

      const nextStatus = action === 'completed' ? 'completed' : action
      const updated = await updateDrugProductionTracking(row.id, { status: nextStatus })
      setRow(updated)
      toast.success(`Statut mis à jour: ${nextStatus}.`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Mise à jour impossible.')
    }
  }

  async function onDelete() {
    if (!row) return
    try {
      await deleteDrugProductionTracking(row.id)
      toast.success('Transaction supprimée.')
      window.location.href = '/drogues/suivi-production'
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Modifier transaction" subtitle="Edition détaillée d'une transaction de suivi production." />
      <div className="flex items-center gap-2">
        <Link href="/drogues/suivi-production"><SecondaryButton><ArrowLeft className="h-4 w-4" />Retour suivi</SecondaryButton></Link>
      </div>

      <Panel>
        {loading ? <p className="text-white/70">Chargement…</p> : null}
        {!loading && !row ? <p className="text-white/70">Transaction introuvable.</p> : null}
        {row ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void quickStatus('received')} className="inline-flex h-10 min-w-[128px] items-center justify-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-100"><PackageCheck className="h-4 w-4" />Reçu</button>
              <button type="button" onClick={() => void quickStatus('completed')} className="inline-flex h-10 min-w-[128px] items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 text-sm font-semibold text-cyan-100"><CheckCircle2 className="h-4 w-4" />Valider</button>
              <button type="button" onClick={() => void quickStatus('in_progress')} className="inline-flex h-10 min-w-[128px] items-center justify-center gap-2 rounded-xl border border-sky-300/35 bg-sky-500/15 px-4 text-sm font-semibold text-sky-100"><Clock3 className="h-4 w-4" />En attente</button>
              <button type="button" onClick={() => void quickStatus('cancelled')} className="inline-flex h-10 min-w-[128px] items-center justify-center gap-2 rounded-xl border border-rose-300/35 bg-rose-500/15 px-4 text-sm font-semibold text-rose-100"><Ban className="h-4 w-4" />Annuler</button>
              <button type="button" onClick={() => void onDelete()} className="inline-flex h-10 min-w-[128px] items-center justify-center gap-2 rounded-xl border border-red-300/35 bg-red-500/15 px-4 text-sm font-semibold text-red-100"><Trash2 className="h-4 w-4" />Supprimer</button>
            </div>

            <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-2">
              <label className="text-sm text-white/75">
                <span className="mb-1 block text-xs text-white/60">{isMethType(row.type) ? 'Meth brut reçu' : 'Pochons reçus'}</span>
                <input
                  value={receivedDraft}
                  onChange={(event) => setReceivedDraft(event.target.value)}
                  inputMode="numeric"
                  className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white outline-none"
                />
              </label>
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm">
                <p className="text-xs text-cyan-100/80">Valeur actuelle enregistrée</p>
                <p className="mt-1 font-semibold">{Math.max(0, Number(row.received_output || 0))}</p>
              </div>
            </div>

            <DemandePartenaireForm
              initial={{
                partnerName: row.partner_name,
                type: normalizeDemandType(row.type),
                mode: inferDemandMode(row.note),
                createdAt: row.created_at.slice(0, 10),
                quantitySeeds: row.quantity_sent,
                quantityLeaves: row.quantity_sent,
                quantityBricks: Math.floor(row.expected_output / 10),
                seedPrice: Number(row.seed_price || 0),
                pouchSalePrice: Number(row.pouch_sale_price || 0),
                brickTransformCost: Number(row.brick_transform_cost || 0),
                pouchTransformCost: Number(row.pouch_transform_cost || 0),
                note: row.note || '',
                expectedDate: row.expected_date || '',
              }}
              submitLabel="Modifier"
              onSubmit={onSubmit}
            />
          </div>
        ) : null}
      </Panel>
    </div>
  )
}
