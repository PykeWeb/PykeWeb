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
      <Link href="/drogues/partenaires" className="text-sm text-cyan-100">← Retour partenaires</Link>
      <div className="grid gap-2 sm:grid-cols-4">
        <Panel><p className="text-xs text-white/70">Transactions</p><p className="text-2xl font-semibold">{partnerRows.length}</p></Panel>
        <Panel><p className="text-xs text-white/70">Attendu</p><p className="text-2xl font-semibold">{partnerRows.reduce((s, r) => s + r.expected_output, 0)}</p></Panel>
        <Panel><p className="text-xs text-white/70">Reçu</p><p className="text-2xl font-semibold">{partnerRows.reduce((s, r) => s + r.received_output, 0)}</p></Panel>
        <Panel><p className="text-xs text-white/70">Taux complétion</p><p className="text-2xl font-semibold">{completionRate}%</p></Panel>
      </div>
      <Panel className="overflow-x-auto">
        <table className="min-w-full text-sm"><thead className="text-left text-white/70"><tr><th>Date</th><th>Type</th><th>Envoyé</th><th>Attendu</th><th>Reçu</th><th>Statut</th></tr></thead>
        <tbody>{partnerRows.map((r) => <tr key={r.id} className="border-t border-white/10"><td className="py-2"><Link href={`/drogues/demandes/${r.id}`} className="text-cyan-100">{new Date(r.created_at).toLocaleDateString('fr-FR')}</Link></td><td>{r.type}</td><td>{r.quantity_sent}</td><td>{r.expected_output}</td><td>{r.received_output}</td><td>{r.status}</td></tr>)}</tbody>
        </table>
      </Panel>
    </div>
  )
}
