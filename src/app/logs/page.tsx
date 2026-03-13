'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { listGroupLogs } from '@/lib/logsApi'
import type { AppLogEntry } from '@/lib/types/logs'
import { getTenantSession } from '@/lib/tenantSession'
import { SearchInput, SecondaryButton } from '@/components/ui/design-system'
import { Panel } from '@/components/ui/Panel'
import { getLogActorDetails } from '@/lib/logActor'
import { PageHeader } from '@/components/PageHeader'

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

export default function LogsPage() {
  const [rows, setRows] = useState<AppLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)

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
    return rows.filter((log) => {
      const actor = getLogActorDetails(log)
      return `${log.area} ${log.action} ${log.message} ${actor.displayName} ${actor.characterName || ''} ${actor.steamAccount || ''} ${actor.fivemLicense || ''} ${log.entity_type || ''} ${log.entity_id || ''}`
        .toLowerCase()
        .includes(q)
    })
  }, [rows, query])

  const selectedLog = useMemo(() => filtered.find((entry) => entry.id === selectedLogId) || null, [filtered, selectedLogId])
  const selectedActor = selectedLog ? getLogActorDetails(selectedLog) : null

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <PageHeader title="Logs" subtitle="Historique des actions du groupe." />
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
              filtered.map((log) => {
                const actor = getLogActorDetails(log)
                return (
                <tr
                  key={log.id}
                  className={`cursor-pointer hover:bg-white/[0.04] ${selectedLogId === log.id ? 'bg-white/[0.03]' : ''}`}
                  onClick={() => setSelectedLogId(log.id)}
                >
                  <td className="px-4 py-3 text-white/70">{formatDate(log.created_at)}</td>
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
            <p><span className="text-white/60">Acteur:</span> {selectedActor.displayName}</p>
            <p><span className="text-white/60">Nom perso:</span> {selectedActor.characterName || '—'}</p>
            <p><span className="text-white/60">Zone:</span> {selectedLog.area}</p>
            <p><span className="text-white/60">Action:</span> {selectedLog.action}</p>
            <p><span className="text-white/60">Type entité:</span> {selectedLog.entity_type || '—'}</p>
            <p><span className="text-white/60">Compte Steam:</span> {selectedActor.steamAccount || '—'}</p>
            <p><span className="text-white/60">License FiveM:</span> {selectedActor.fivemLicense || '—'}</p>
            <p className="md:col-span-2"><span className="text-white/60">ID entité:</span> {selectedLog.entity_id || '—'}</p>
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
