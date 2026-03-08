'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { listGroupLogs } from '@/lib/logsApi'
import type { AppLogEntry } from '@/lib/types/logs'
import { getTenantSession } from '@/lib/tenantSession'
import { SearchInput, SecondaryButton } from '@/components/ui/design-system'
import { Panel } from '@/components/ui/Panel'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR')
}

export default function LogsPage() {
  const [rows, setRows] = useState<AppLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const session = getTenantSession()
    if (!session) {
      window.location.href = '/login'
      return
    }

    void (async () => {
      try {
        setLoading(true)
        setRows(await listGroupLogs())
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les logs.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((log) => `${log.area} ${log.action} ${log.message} ${log.actor_name || ''}`.toLowerCase().includes(q))
  }, [rows, query])

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Logs</h1>
          <p className="text-sm text-white/60">Historique des actions du groupe.</p>
        </div>
        <Link href="/"><SecondaryButton>Retour</SecondaryButton></Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans les logs..." className="w-[320px] max-w-full" />
        <div className="text-sm text-white/60">{filtered.length} log(s)</div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-white/70">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Acteur</th>
              <th className="px-4 py-3 text-left font-medium">Zone</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-white/60">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-white/60">Aucun log.</td></tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-white/70">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3">{log.actor_name || '—'}</td>
                  <td className="px-4 py-3">{log.area}</td>
                  <td className="px-4 py-3">{log.action}</td>
                  <td className="px-4 py-3">{log.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {error ? <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
    </Panel>
  )
}
