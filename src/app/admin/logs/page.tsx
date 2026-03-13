'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { listAdminLogs } from '@/lib/logsApi'
import { PageHeader } from '@/components/PageHeader'
import type { AppLogEntry } from '@/lib/types/logs'
import { getTenantSession } from '@/lib/tenantSession'
import { SearchInput, SecondaryButton, TabPill } from '@/components/ui/design-system'
import { Panel } from '@/components/ui/Panel'
import { getLogActorDetails } from '@/lib/logActor'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR')
}

function formatPayload(value: Record<string, unknown> | null) {
  if (!value) return '—'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return 'Payload invalide'
  }
}

export default function AdminLogsPage() {
  const [rows, setRows] = useState<AppLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)

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
      const actor = getLogActorDetails(log)
      if (groupFilter !== 'all' && groupName !== groupFilter) return false
      if (!q) return true
      return `${groupName} ${log.area} ${log.action} ${log.message} ${actor.displayName} ${actor.characterName || ''} ${actor.steamAccount || ''} ${actor.fivemLicense || ''} ${log.entity_type || ''} ${log.entity_id || ''}`
        .toLowerCase()
        .includes(q)
    })
  }, [rows, query, groupFilter])

  const selectedLog = useMemo(() => filtered.find((entry) => entry.id === selectedLogId) || null, [filtered, selectedLogId])
  const selectedActor = selectedLog ? getLogActorDetails(selectedLog) : null

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <PageHeader title="Admin · Logs" subtitle="Vision globale des actions pour tous les groupes." />
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
              filtered.map((log) => {
                const actor = getLogActorDetails(log)
                return (
                <tr
                  key={log.id}
                  className={`cursor-pointer hover:bg-white/[0.04] ${selectedLogId === log.id ? 'bg-white/[0.03]' : ''}`}
                  onClick={() => setSelectedLogId(log.id)}
                >
                  <td className="px-4 py-3 text-white/70">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3">{log.group_name || log.group_id}</td>
                  <td className="px-4 py-3">{actor.displayName}</td>
                  <td className="px-4 py-3">{log.area}</td>
                  <td className="px-4 py-3">{log.action}</td>
                  <td className="px-4 py-3">{log.message}</td>
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedLog && selectedActor ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Détail du log</h2>
            <span className="text-xs text-white/60">ID: {selectedLog.id}</span>
          </div>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <p><span className="text-white/60">Date:</span> {formatDate(selectedLog.created_at)}</p>
            <p><span className="text-white/60">Source acteur:</span> {selectedLog.actor_source}</p>
            <p><span className="text-white/60">Groupe:</span> {selectedLog.group_name || selectedLog.group_id}</p>
            <p><span className="text-white/60">Acteur:</span> {selectedActor.displayName}</p>
            <p><span className="text-white/60">Nom perso:</span> {selectedActor.characterName || '—'}</p>
            <p><span className="text-white/60">Zone:</span> {selectedLog.area}</p>
            <p><span className="text-white/60">Action:</span> {selectedLog.action}</p>
            <p><span className="text-white/60">Type entité:</span> {selectedLog.entity_type || '—'}</p>
            <p><span className="text-white/60">Compte Steam:</span> {selectedActor.steamAccount || '—'}</p>
            <p><span className="text-white/60">License FiveM:</span> {selectedActor.fivemLicense || '—'}</p>
            <p><span className="text-white/60">ID entité:</span> {selectedLog.entity_id || '—'}</p>
            <p className="md:col-span-2"><span className="text-white/60">Message:</span> {selectedLog.message}</p>
          </div>
          <div className="mt-3">
            <p className="mb-1 text-xs text-white/60">Payload JSON</p>
            <pre className="max-h-56 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/80">{formatPayload(selectedLog.payload)}</pre>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
    </Panel>
  )
}
