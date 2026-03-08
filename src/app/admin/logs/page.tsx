'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { listAdminLogs } from '@/lib/logsApi'
import type { AppLogEntry } from '@/lib/types/logs'
import { getTenantSession } from '@/lib/tenantSession'
import { SearchInput, SecondaryButton, TabPill } from '@/components/ui/design-system'
import { Panel } from '@/components/ui/Panel'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR')
}

export default function AdminLogsPage() {
  const [rows, setRows] = useState<AppLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')

  useEffect(() => {
    const session = getTenantSession()
    if (!(session?.isAdmin || session?.groupId === 'admin')) {
      window.location.href = '/'
      return
    }

    void (async () => {
      try {
        setLoading(true)
        setRows(await listAdminLogs())
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les logs admin.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const groups = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => row.group_name || row.group_id))).filter(Boolean)
    return values.slice(0, 20)
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((log) => {
      const groupName = log.group_name || log.group_id
      if (groupFilter !== 'all' && groupName !== groupFilter) return false
      if (!q) return true
      return `${groupName} ${log.area} ${log.action} ${log.message} ${log.actor_name || ''}`.toLowerCase().includes(q)
    })
  }, [rows, query, groupFilter])

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Admin · Logs</h1>
          <p className="text-sm text-white/60">Vision globale des actions pour tous les groupes.</p>
        </div>
        <Link href="/admin/dashboard"><SecondaryButton>Retour</SecondaryButton></Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <TabPill active={groupFilter === 'all'} onClick={() => setGroupFilter('all')}>Tous les groupes</TabPill>
        {groups.map((groupName) => (
          <TabPill key={groupName} active={groupFilter === groupName} onClick={() => setGroupFilter(groupName)}>{groupName}</TabPill>
        ))}
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
              <th className="px-4 py-3 text-left font-medium">Groupe</th>
              <th className="px-4 py-3 text-left font-medium">Acteur</th>
              <th className="px-4 py-3 text-left font-medium">Zone</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-white/60">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-white/60">Aucun log.</td></tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-white/70">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3">{log.group_name || log.group_id}</td>
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
