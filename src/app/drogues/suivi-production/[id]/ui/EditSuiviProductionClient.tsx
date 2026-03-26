'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Save, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { SecondaryButton } from '@/components/ui/design-system'
import { listDrugProductionTrackings, updateDrugProductionTracking, type DrugProductionTrackingRow } from '@/lib/drugProductionTrackingApi'

export default function EditSuiviProductionClient({ id }: { id: string }) {
  const [row, setRow] = useState<DrugProductionTrackingRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [received, setReceived] = useState('0')
  const [note, setNote] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listDrugProductionTrackings()
        const found = rows.find((entry) => entry.id === id) || null
        setRow(found)
        setReceived(String(found?.received_output ?? 0))
        setNote(found?.note || '')
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'Impossible de charger la transaction.')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const remaining = useMemo(() => {
    if (!row) return 0
    return Math.max(0, row.expected_output - Number(received || 0))
  }, [received, row])

  async function onSave(mode: 'edit' | 'validate' | 'cancel') {
    if (!row) return
    setSaving(true)
    try {
      const receivedValue = Math.max(0, Math.floor(Number(received || 0)))
      const status = mode === 'cancel'
        ? 'cancelled'
        : mode === 'validate'
          ? (receivedValue >= row.expected_output ? 'completed' : 'in_progress')
          : undefined

      const updated = await updateDrugProductionTracking(row.id, {
        receivedOutput: receivedValue,
        note,
        status,
      })
      setRow(updated)
      setReceived(String(updated.received_output || 0))
      setNote(updated.note || '')
      toast.success(mode === 'cancel' ? 'Transaction annulée.' : mode === 'validate' ? 'Réception validée.' : 'Transaction modifiée.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Mise à jour impossible.')
    } finally {
      setSaving(false)
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
            <div className="grid gap-2 sm:grid-cols-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <p>Groupe: <span className="font-semibold">{row.partner_name}</span></p>
              <p>Type: <span className="font-semibold">{row.type}</span></p>
              <p>Envoyé: <span className="font-semibold">{row.quantity_sent}</span></p>
              <p>Attendu: <span className="font-semibold">{row.expected_output}</span></p>
              <p>Reçu: <span className="font-semibold">{row.received_output}</span></p>
              <p>Statut: <span className="font-semibold">{row.status}</span></p>
            </div>

            <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm text-cyan-100">
              Reste à recevoir : {remaining}
            </div>

            <div>
              <p className="mb-1 text-xs text-white/70">Reçu</p>
              <Input value={received} onChange={(event) => setReceived(event.target.value)} inputMode="numeric" />
            </div>

            <div>
              <p className="mb-1 text-xs text-white/70">Note</p>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => void onSave('validate')} className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-4 font-semibold text-emerald-100">
                <CheckCircle2 className="h-4 w-4" />Valider réception
              </button>
              <button type="button" disabled={saving} onClick={() => void onSave('edit')} className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-300/35 bg-amber-500/15 px-4 font-semibold text-amber-100">
                <Save className="h-4 w-4" />Enregistrer
              </button>
              <button type="button" disabled={saving} onClick={() => void onSave('cancel')} className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-300/35 bg-rose-500/15 px-4 font-semibold text-rose-100">
                <XCircle className="h-4 w-4" />Annuler
              </button>
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  )
}
