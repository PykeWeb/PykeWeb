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

export default function EditSuiviProductionClient({ id }: { id: string }) {
  const router = useRouter()
  const [row, setRow] = useState<DrugProductionTrackingRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listDrugProductionTrackings()
        setRow(rows.find((entry) => entry.id === id) || null)
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'Impossible de charger la transaction.')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  async function onSubmit(value: DemandFormValue, expectedOutput: number) {
    if (!row) return
    const status = row.received_output >= expectedOutput ? 'completed' : 'in_progress'
    const updated = await updateDrugProductionTracking(row.id, {
      note: `[${value.mode}] ${value.note || ''}`.trim(),
      seedPrice: value.seedPrice,
      pouchSalePrice: value.pouchSalePrice,
      brickTransformCost: value.brickTransformCost,
      pouchTransformCost: value.pouchTransformCost,
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

            <DemandePartenaireForm
              initial={{
                partnerName: row.partner_name,
                type: row.type,
                mode: 'full_chain',
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
