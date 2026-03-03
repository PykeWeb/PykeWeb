'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getTenantSession } from '@/lib/tenantSession'
import { listSupportTicketsAdmin, updateSupportTicketStatus, type SupportTicket } from '@/lib/communicationApi'
import { copyToClipboard } from '@/lib/utils/password'
import { GlassSelect } from '@/components/ui/GlassSelect'

type StatusFilter = 'all' | SupportTicket['status']
type SortOrder = 'newest' | 'oldest'

function statusLabel(status: SupportTicket['status']) {
  if (status === 'open') return 'Ouvert'
  if (status === 'in_progress') return 'En cours'
  return 'Résolu'
}

function TicketDetailModal({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: SupportTicket | null
  onClose: () => void
  onSaved: (id: string, status: SupportTicket['status']) => Promise<void>
}) {
  const [status, setStatus] = useState<SupportTicket['status']>('open')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!ticket) return
    setStatus(ticket.status)
  }, [ticket])

  if (!ticket) return null

  async function save() {
    if (!ticket) return
    setSaving(true)
    try {
      await onSaved(ticket.id, status)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0f1625]/95 p-5 shadow-glow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{ticket.tenant_groups?.name || ticket.group_id}</p>
            <p className="text-xs text-white/60">{new Date(ticket.created_at).toLocaleString('fr-FR')}</p>
          </div>
          <span className="rounded-full border border-white/15 bg-white/[0.08] px-2 py-0.5 text-[11px] text-white/80">{statusLabel(ticket.status)}</span>
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm text-white/80">{ticket.message}</p>

        {ticket.image_url ? (
          <a href={ticket.image_url} target="_blank" className="mt-3 inline-block text-sm underline decoration-white/40 underline-offset-2">Voir image</a>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <GlassSelect value={status} onChange={(v) => setStatus(v as SupportTicket['status'])} options={[{ value: 'open', label: 'Ouvert' }, { value: 'in_progress', label: 'En cours' }, { value: 'resolved', label: 'Résolu' }]} />
          <button onClick={() => void copyToClipboard(ticket.message)} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">Copier</button>
          <button onClick={onClose} className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm hover:bg-white/[0.12]">Fermer</button>
          <button onClick={() => void save()} disabled={saving} className="h-10 rounded-2xl border border-white/15 bg-white/[0.09] px-3 text-sm font-semibold hover:bg-white/[0.14] disabled:opacity-60">{saving ? 'Sauvegarde…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

function TicketColumn({
  title,
  rows,
  onOpen,
}: {
  title: string
  rows: SupportTicket[]
  onOpen: (ticket: SupportTicket) => void
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-2 space-y-2">
        {rows.length === 0 ? <p className="text-xs text-white/60">Aucun ticket.</p> : null}
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{row.tenant_groups?.name || row.group_id} — {new Date(row.created_at).toLocaleString('fr-FR')}</p>
              <span className="rounded-full border border-white/15 bg-white/[0.08] px-2 py-0.5 text-[11px] text-white/80">{statusLabel(row.status)}</span>
            </div>
            <p
              className="mt-2 text-white/70"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {row.message}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => onOpen(row)} className="h-9 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-xs hover:bg-white/[0.12]">Voir</button>
              {row.image_url ? <a href={row.image_url} target="_blank" className="text-xs underline">Voir image</a> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminSupportPage() {
  const [bugs, setBugs] = useState<SupportTicket[]>([])
  const [messages, setMessages] = useState<SupportTicket[]>([])
  const [showResolved, setShowResolved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [selected, setSelected] = useState<SupportTicket | null>(null)

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

  const normalize = useCallback((rows: SupportTicket[]) => {
    const q = query.trim().toLowerCase()
    const filtered = rows.filter((row) => {
      const statusOk = statusFilter === 'all' || row.status === statusFilter
      const queryOk = !q || row.message.toLowerCase().includes(q) || (row.tenant_groups?.name || '').toLowerCase().includes(q)
      return statusOk && queryOk
    })
    return filtered.sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return sortOrder === 'newest' ? diff : -diff
    })
  }, [query, statusFilter, sortOrder])

  const normalizedBugs = useMemo(() => normalize(bugs), [bugs, normalize])
  const normalizedMessages = useMemo(() => normalize(messages), [messages, normalize])

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

        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" className="h-10 rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
          <GlassSelect value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} options={[{ value: 'all', label: 'Tout' }, { value: 'open', label: 'Ouvert' }, { value: 'in_progress', label: 'En cours' }, { value: 'resolved', label: 'Résolu' }]} />
          <GlassSelect value={sortOrder} onChange={(v) => setSortOrder(v as SortOrder)} options={[{ value: 'newest', label: 'Plus récent' }, { value: 'oldest', label: 'Plus ancien' }]} />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TicketColumn title="Bugs" rows={normalizedBugs} onOpen={setSelected} />
          <TicketColumn title="Messages" rows={normalizedMessages} onOpen={setSelected} />
        </div>
        {error ? <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      </div>

      <TicketDetailModal ticket={selected} onClose={() => setSelected(null)} onSaved={setTicketStatus} />
    </div>
  )
}
