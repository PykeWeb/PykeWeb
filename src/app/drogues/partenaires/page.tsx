'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { listDrugProductionTrackings, type DrugProductionTrackingRow } from '@/lib/drugProductionTrackingApi'

export default function PartenairesPage() {
  const [rows, setRows] = useState<DrugProductionTrackingRow[]>([])

  useEffect(() => { void listDrugProductionTrackings().then(setRows).catch(() => setRows([])) }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, DrugProductionTrackingRow[]>()
    rows.forEach((row) => {
      const key = row.partner_name || 'Inconnu'
      map.set(key, [...(map.get(key) || []), row])
    })
    return Array.from(map.entries()).map(([name, items]) => {
      const inProgress = items.filter((i) => i.status === 'in_progress').length
      const completed = items.filter((i) => i.status === 'completed').length
      const sent = items.reduce((s, i) => s + i.quantity_sent, 0)
      const received = items.reduce((s, i) => s + i.received_output, 0)
      return { name, count: items.length, inProgress, completed, sent, received }
    }).sort((a, b) => b.count - a.count)
  }, [rows])

  const totalExpected = rows.reduce((s, r) => s + r.expected_output, 0)
  const totalReceived = rows.reduce((s, r) => s + r.received_output, 0)
  const top = grouped[0]

  return (
    <div className="space-y-4">
      <PageHeader title="Partenaires" subtitle="Vue consolidée des demandes partenaires" />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <Panel><p className="text-xs text-white/70">Total en cours</p><p className="text-2xl font-semibold">{rows.filter((r) => r.status === 'in_progress').length}</p></Panel>
        <Panel><p className="text-xs text-white/70">Total terminé</p><p className="text-2xl font-semibold">{rows.filter((r) => r.status === 'completed').length}</p></Panel>
        <Panel><p className="text-xs text-white/70">Pochons attendus</p><p className="text-2xl font-semibold">{totalExpected}</p></Panel>
        <Panel><p className="text-xs text-white/70">Pochons reçus</p><p className="text-2xl font-semibold">{totalReceived}</p></Panel>
        <Panel><p className="text-xs text-white/70">Nombre partenaires</p><p className="text-2xl font-semibold">{grouped.length}</p></Panel>
        <Panel><p className="text-xs text-white/70">Top partenaire</p><p className="text-lg font-semibold">{top?.name || '—'}</p></Panel>
      </div>

      <Panel className="overflow-x-auto">
        <table className="min-w-full text-sm"><thead className="text-left text-white/70"><tr><th>Nom</th><th>Transactions</th><th>En cours</th><th>Terminé</th><th>Total envoyé</th><th>Total reçu</th><th>Bénéfice estimé</th></tr></thead>
          <tbody>{grouped.map((g) => (<tr key={g.name} className="border-t border-white/10 hover:bg-white/[0.04]"><td className="py-2"><Link href={`/drogues/partenaires/${encodeURIComponent(g.name)}`} className="font-semibold text-cyan-100">{g.name}</Link></td><td>{g.count}</td><td>{g.inProgress}</td><td>{g.completed}</td><td>{g.sent}</td><td>{g.received}</td><td>{Math.max(0, g.received * 150)}</td></tr>))}</tbody>
        </table>
      </Panel>
    </div>
  )
}
