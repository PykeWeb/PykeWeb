'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { listDrugProductionTrackings, type DrugProductionTrackingRow } from '@/lib/drugProductionTrackingApi'

export default function PartenaireDetailPage() {
  const params = useParams<{ id: string }>()
  const partner = decodeURIComponent(params.id)
  const [rows, setRows] = useState<DrugProductionTrackingRow[]>([])
  useEffect(() => { void listDrugProductionTrackings().then(setRows).catch(() => setRows([])) }, [])

  const partnerRows = useMemo(() => rows.filter((r) => r.partner_name === partner), [rows, partner])
  const completionRate = useMemo(() => {
    if (!partnerRows.length) return 0
    return Math.round((partnerRows.filter((r) => r.status === 'completed').length / partnerRows.length) * 100)
  }, [partnerRows])

  return (
    <div className="space-y-4">
      <PageHeader title={`Partenaire: ${partner}`} subtitle="Détail des transactions partenaires" />
      <div className="flex items-center gap-2">
        <Link href="/drogues/partenaires" className="inline-flex h-10 items-center rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20">← Retour partenaires</Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Panel className="border-cyan-300/25 bg-cyan-500/10"><p className="text-xs text-cyan-100/80">Transactions</p><p className="text-2xl font-semibold">{partnerRows.length}</p></Panel>
        <Panel className="border-emerald-300/25 bg-emerald-500/10"><p className="text-xs text-emerald-100/80">Attendu</p><p className="text-2xl font-semibold">{partnerRows.reduce((s, r) => s + r.expected_output, 0)}</p></Panel>
        <Panel className="border-rose-300/25 bg-rose-500/10"><p className="text-xs text-rose-100/80">Reçu</p><p className="text-2xl font-semibold">{partnerRows.reduce((s, r) => s + r.received_output, 0)}</p></Panel>
        <Panel className="border-violet-300/25 bg-violet-500/10"><p className="text-xs text-violet-100/80">Taux complétion</p><p className="text-2xl font-semibold">{completionRate}%</p></Panel>
      </div>
      <Panel className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-white/70"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Envoyé</th><th className="px-3 py-3">Attendu</th><th className="px-3 py-3">Reçu</th><th className="px-3 py-3">Statut</th></tr></thead>
          <tbody>{partnerRows.map((r) => <tr key={r.id} className="border-t border-white/10 hover:bg-white/[0.04]"><td className="px-3 py-2"><Link href={`/drogues/demandes/${r.id}`} className="text-cyan-100">{new Date(r.created_at).toLocaleDateString('fr-FR')}</Link></td><td className="px-3 py-2">{r.type}</td><td className="px-3 py-2">{r.quantity_sent}</td><td className="px-3 py-2">{r.expected_output}</td><td className="px-3 py-2">{r.received_output}</td><td className="px-3 py-2">{r.status}</td></tr>)}</tbody>
        </table>
      </Panel>
    </div>
  )
}
