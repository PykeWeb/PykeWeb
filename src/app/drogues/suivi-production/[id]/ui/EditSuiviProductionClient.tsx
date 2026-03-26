'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { SecondaryButton } from '@/components/ui/design-system'
import { DemandePartenaireForm, type DemandFormValue } from '@/components/modules/drogues/DemandePartenaireForm'
import { listDrugProductionTrackings, updateDrugProductionTracking, type DrugProductionTrackingRow } from '@/lib/drugProductionTrackingApi'

export default function EditSuiviProductionClient({ id }: { id: string }) {
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
      status,
    })
    setRow(updated)
    toast.success('Transaction modifiée.')
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
          <DemandePartenaireForm
            initial={{
              partnerName: row.partner_name,
              type: row.type,
              mode: 'full_chain',
              createdAt: row.created_at.slice(0, 10),
              quantitySeeds: row.quantity_sent,
              quantityLeaves: row.quantity_sent,
              quantityBricks: Math.floor(row.expected_output / 10),
              seedPrice: 0,
              pouchSalePrice: 0,
              brickTransformCost: 0,
              pouchTransformCost: 0,
              note: row.note || '',
              expectedDate: row.expected_date || '',
            }}
            submitLabel="Modifier"
            onSubmit={onSubmit}
          />
        ) : null}
      </Panel>
    </div>
  )
}
