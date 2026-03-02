'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { currentGroupId } from '@/lib/tenantScope'
import { StatCard } from '@/components/dashboard/StatCard'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { listActivePatchNotes, createSupportTicket, getCurrentGroupAccessInfo, type PatchNote } from '@/lib/communicationApi'
import { Box, Handshake, ArrowDownRight, ArrowUpRight, Receipt } from 'lucide-react'

type Tx = {
  id: string
  type: 'purchase' | 'sale'
  total: number | null
  counterparty: string | null
  created_at: string
  transaction_items?: { name_snapshot: string | null; quantity: number | null }[] | null
}

type Loan = {
  id: string
  borrower_name: string
  quantity: number
  loaned_at: string
  weapons: { name: string | null; weapon_id: string | null }[] | null
}

type AccessInfo = { paid_until: string | null; active: boolean }

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function DashboardClient() {
  const [loading, setLoading] = useState(true)
  const [objectCount, setObjectCount] = useState(0)
  const [weaponCount, setWeaponCount] = useState(0)
  const [activeLoans, setActiveLoans] = useState(0)
  const [txToday, setTxToday] = useState(0)
  const [recentTx, setRecentTx] = useState<Tx[]>([])
  const [recentLoans, setRecentLoans] = useState<Loan[]>([])
  const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null)
  const [patchNotes, setPatchNotes] = useState<PatchNote[]>([])
  const [ticketKind, setTicketKind] = useState<'bug' | 'message'>('bug')
  const [ticketMessage, setTicketMessage] = useState('')
  const [ticketImage, setTicketImage] = useState<File | null>(null)
  const [ticketStatus, setTicketStatus] = useState('')

  const todayIso = useMemo(() => startOfTodayIso(), [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const groupId = currentGroupId()
        const [objRes, weapRes, loansRes, txRes, recentTxRes, recentLoansRes, access, notes] = await Promise.all([
          supabase.from('objects').select('id', { count: 'exact', head: true }).eq('group_id', groupId),
          supabase.from('weapons').select('id', { count: 'exact', head: true }).eq('group_id', groupId),
          supabase.from('weapon_loans').select('id', { count: 'exact', head: true }).eq('group_id', groupId).is('returned_at', null),
          supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('group_id', groupId).gte('created_at', todayIso),
          supabase
            .from('transactions')
            .select('id,type,total,counterparty,created_at,transaction_items(name_snapshot,quantity)')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('weapon_loans')
            .select('id,borrower_name,quantity,loaned_at,weapons(name,weapon_id)')
            .eq('group_id', groupId)
            .is('returned_at', null)
            .order('loaned_at', { ascending: false })
            .limit(5),
          getCurrentGroupAccessInfo(),
          listActivePatchNotes(3),
        ])

        if (!alive) return
        setObjectCount(objRes.count ?? 0)
        setWeaponCount(weapRes.count ?? 0)
        setActiveLoans(loansRes.count ?? 0)
        setTxToday(txRes.count ?? 0)
        setRecentTx((recentTxRes.data as Tx[]) ?? [])
        setRecentLoans((recentLoansRes.data as Loan[]) ?? [])
        setAccessInfo(access ? { paid_until: access.paid_until, active: access.active } : null)
        setPatchNotes(notes)
      } finally {
        if (alive) setLoading(false)
      }
    })().catch(() => {
      if (alive) setLoading(false)
    })

    return () => {
      alive = false
    }
  }, [todayIso])

  const expirationLabel = useMemo(() => {
    if (!accessInfo) return 'Accès : —'
    if (!accessInfo.active) return 'Expiré (désactivé)'
    if (!accessInfo.paid_until) return 'Accès illimité'
    const ts = new Date(accessInfo.paid_until).getTime()
    if (ts < Date.now()) return 'Expiré'
    return `Accès valide jusqu’au : ${new Date(accessInfo.paid_until).toLocaleDateString('fr-FR')}`
  }, [accessInfo])

  const expirationClass = useMemo(() => {
    if (!accessInfo?.active) return 'text-rose-300'
    if (!accessInfo?.paid_until) return 'text-emerald-200'
    const ts = new Date(accessInfo.paid_until).getTime()
    if (ts < Date.now()) return 'text-rose-300'
    if (ts - Date.now() < 3 * 24 * 60 * 60 * 1000) return 'text-orange-300'
    return 'text-white/80'
  }, [accessInfo])

  async function submitTicket() {
    if (!ticketMessage.trim()) {
      setTicketStatus('Message requis.')
      return
    }
    try {
      await createSupportTicket({ kind: ticketKind, message: ticketMessage.trim(), imageFile: ticketImage })
      setTicketMessage('')
      setTicketImage(null)
      setTicketStatus(ticketKind === 'bug' ? 'Bug envoyé.' : 'Message envoyé.')
    } catch (e: any) {
      setTicketStatus(e?.message || 'Envoi impossible')
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard title="Objets" value={loading ? '—' : String(objectCount)} icon={<Box className="h-5 w-5" />} href="/objets" />
          <StatCard title="Armes" value={loading ? '—' : String(weaponCount)} icon={<Box className="h-5 w-5" />} href="/armes" />
          <StatCard title="Prêts en cours" value={loading ? '—' : String(activeLoans)} icon={<Handshake className="h-5 w-5" />} href="/armes/prets" />
          <StatCard title="Transactions aujourd'hui" value={loading ? '—' : String(txToday)} icon={<Receipt className="h-5 w-5" />} href="/transactions" />
        </div>

        <Panel>
          <h3 className="text-sm font-semibold">Dernière activité</h3>
          <div className="mt-3 space-y-2">
            {recentTx.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">Aucune transaction pour le moment.</div>
            ) : (
              recentTx.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      <span
                        className={`mr-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                          t.type === 'purchase'
                            ? 'border-emerald-300/40 bg-emerald-500/10 text-emerald-100'
                            : 'border-orange-300/40 bg-orange-500/10 text-orange-100'
                        }`}
                      >
                        {t.type === 'purchase' ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {t.type === 'purchase' ? 'Entrée' : 'Sortie'}
                      </span>
                      {t.counterparty ? `• ${t.counterparty}` : ''}
                    </p>
                    <p className="text-xs text-white/60">{new Date(t.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-sm font-semibold text-white/80">{t.total ?? '—'}</div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <p className={`text-sm font-semibold ${expirationClass}`}>{expirationLabel}</p>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel>
          <h3 className="text-sm font-semibold">Quick actions</h3>
          <p className="mt-1 text-sm text-white/60">Raccourcis utiles</p>
          <div className="mt-4 space-y-3">
            <Link href="/transactions/nouveau?type=purchase" className="block rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">+ Nouvel achat</Link>
            <Link href="/armes/prets" className="block rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Prêts en cours</Link>
            <Link href="/objets" className="block rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">Catalogue</Link>
          </div>
        </Panel>

        <Panel>
          <h3 className="text-sm font-semibold">Patch notes</h3>
          <div className="mt-3 space-y-2">
            {patchNotes.length === 0 ? (
              <p className="text-xs text-white/60">Aucune note active.</p>
            ) : (
              patchNotes.map((n) => (
                <div key={n.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="mt-1 text-xs text-white/70">{n.content}</p>
                  <p className="mt-1 text-[11px] text-white/50">{new Date(n.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <h3 className="text-sm font-semibold">Support</h3>
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <button type="button" onClick={() => setTicketKind('bug')} className={`rounded-lg border px-2 py-1 text-xs ${ticketKind === 'bug' ? 'border-rose-300/50 bg-rose-500/10 text-rose-100' : 'border-white/10 bg-white/5'}`}>Signaler un bug</button>
              <button type="button" onClick={() => setTicketKind('message')} className={`rounded-lg border px-2 py-1 text-xs ${ticketKind === 'message' ? 'border-cyan-300/50 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/5'}`}>Message</button>
            </div>
            <textarea value={ticketMessage} onChange={(e) => setTicketMessage(e.target.value)} placeholder={ticketKind === 'bug' ? 'Décris le bug...' : 'Ton message...'} className="h-24 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
            <input type="file" accept="image/*" onChange={(e) => setTicketImage(e.target.files?.[0] ?? null)} className="w-full text-xs text-white/70" />
            <Button onClick={submitTicket}>{ticketKind === 'bug' ? 'Envoyer le bug' : 'Envoyer le message'}</Button>
            {ticketStatus ? <p className="text-xs text-white/70">{ticketStatus}</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  )
}
