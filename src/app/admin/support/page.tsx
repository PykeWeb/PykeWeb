'use client'

import { useCallback, useEffect, useState } from 'react'
import { getTenantSession } from '@/lib/tenantSession'
import { listSupportTicketsAdmin, updateSupportTicketStatus, type SupportTicket } from '@/lib/communicationApi'

export default function AdminSupportPage() {
  const [bugs, setBugs] = useState<SupportTicket[]>([])
  const [messages, setMessages] = useState<SupportTicket[]>([])
  const [showResolved, setShowResolved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (includeResolved = showResolved) => {
    try {
      const [bugRows, msgRows] = await Promise.all([
        listSupportTicketsAdmin('bug', includeResolved),
        listSupportTicketsAdmin('message', includeResolved),
      ])
      setBugs(bugRows)
      setMessages(msgRows)
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Erreur chargement tickets')
    }
  }, [showResolved])

  useEffect(() => {
    const session = getTenantSession()
    if (!session?.isAdmin) {
      window.location.href = '/'
      return
    }
    void refresh()
  }, [refresh])

  useEffect(() => {
    void refresh(showResolved)
  }, [showResolved, refresh])

  async function setTicketStatus(id: string, status: SupportTicket['status']) {
    try {
      await updateSupportTicketStatus(id, status)
      await refresh(showResolved)
    } catch (e: any) {
      setError(e?.message || 'Impossible de mettre à jour le ticket.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold">Support</h1>
          <label className="inline-flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5" />
            Afficher les résolus
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TicketColumn title="Bugs" rows={bugs} onChangeStatus={setTicketStatus} />
          <TicketColumn title="Messages" rows={messages} onChangeStatus={setTicketStatus} />
        </div>
        {error ? <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      </div>
    </div>
  )
}

function TicketColumn({ title, rows, onChangeStatus }: { title: string; rows: SupportTicket[]; onChangeStatus: (id: string, status: SupportTicket['status']) => Promise<void> }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-2 space-y-2">
        {rows.length === 0 ? <p className="text-xs text-white/60">Aucun ticket.</p> : null}
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <p className="font-medium">{row.tenant_groups?.name || row.group_id} — {new Date(row.created_at).toLocaleString()}</p>
            <p className="mt-1 text-white/70">{row.message}</p>
            {row.image_url ? <a href={row.image_url} target="_blank" className="mt-1 block underline">Voir image</a> : null}
            <select value={row.status} onChange={(e) => void onChangeStatus(row.id, e.target.value as SupportTicket['status'])} className="mt-2 h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm">
              <option value="open">Ouvert</option>
              <option value="in_progress">En cours</option>
              <option value="resolved">Résolu</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
