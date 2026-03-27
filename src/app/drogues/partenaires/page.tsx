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
      <div className="flex items-center gap-2">
        <Link href="/drogues/suivi-production" className="inline-flex h-10 items-center rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20">
          ← Retour suivi
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <Panel className="border-sky-300/25 bg-gradient-to-br from-sky-500/15 to-blue-600/15"><p className="text-xs text-sky-100/80">Total en cours</p><p className="text-2xl font-semibold">{rows.filter((r) => r.status === 'in_progress').length}</p></Panel>
        <Panel className="border-violet-300/25 bg-gradient-to-br from-violet-500/15 to-fuchsia-600/15"><p className="text-xs text-violet-100/80">Total terminé</p><p className="text-2xl font-semibold">{rows.filter((r) => r.status === 'completed').length}</p></Panel>
        <Panel className="border-emerald-300/25 bg-gradient-to-br from-emerald-500/15 to-teal-600/15"><p className="text-xs text-emerald-100/80">Pochons attendus</p><p className="text-2xl font-semibold">{totalExpected}</p></Panel>
        <Panel className="border-rose-300/25 bg-gradient-to-br from-rose-500/15 to-red-600/15"><p className="text-xs text-rose-100/80">Pochons reçus</p><p className="text-2xl font-semibold">{totalReceived}</p></Panel>
        <Panel className="border-cyan-300/25 bg-gradient-to-br from-cyan-500/15 to-blue-600/15"><p className="text-xs text-cyan-100/80">Nombre partenaires</p><p className="text-2xl font-semibold">{grouped.length}</p></Panel>
        <Panel className="border-amber-300/25 bg-gradient-to-br from-amber-500/15 to-orange-600/15"><p className="text-xs text-amber-100/80">Top partenaire</p><p className="text-lg font-semibold">{top?.name || '—'}</p></Panel>
      </div>

      <Panel className="overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-white/70">
            <tr><th className="px-3 py-3">Nom</th><th className="px-3 py-3">Transactions</th><th className="px-3 py-3">En cours</th><th className="px-3 py-3">Terminé</th><th className="px-3 py-3">Total envoyé</th><th className="px-3 py-3">Total reçu</th><th className="px-3 py-3">Bénéfice estimé</th></tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <tr key={g.name} className="border-t border-white/10 hover:bg-white/[0.04]">
                <td className="px-3 py-2"><Link href={`/drogues/partenaires/${encodeURIComponent(g.name)}`} className="font-semibold text-cyan-100">{g.name}</Link></td>
                <td className="px-3 py-2">{g.count}</td><td className="px-3 py-2">{g.inProgress}</td><td className="px-3 py-2">{g.completed}</td><td className="px-3 py-2">{g.sent}</td><td className="px-3 py-2">{g.received}</td><td className="px-3 py-2">{Math.max(0, g.received * 150)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
