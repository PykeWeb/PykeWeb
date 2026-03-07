'use client'

import { useEffect, useMemo, useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { PrimaryButton } from '@/components/ui/design-system'
import { Input } from '@/components/ui/Input'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { getTenantSession } from '@/lib/tenantSession'
import { TABLET_PHONE, TABLET_WEEKLY_PRICE, type TabletRentalTicket } from '@/lib/tabletRental'

export default function TablettePaiementPage() {
  const [weeks, setWeeks] = useState(1)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tickets, setTickets] = useState<TabletRentalTicket[]>([])
  const [groupName, setGroupName] = useState('Groupe')

  const amount = useMemo(() => Math.max(1, weeks) * TABLET_WEEKLY_PRICE, [weeks])

  async function refresh() {
    const res = await fetch('/api/tablette/rentals', { cache: 'no-store' })
    if (!res.ok) return
    const rows = (await res.json()) as TabletRentalTicket[]
    setTickets(rows)
  }

  useEffect(() => {
    const session = getTenantSession()
    setGroupName(session?.groupName || 'Groupe')
    void refresh()
  }, [])

  async function submit() {
    if (!proofFile) {
      setError('Ajoute une preuve image (jpg/png).')
      return
    }
    setSending(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('weeks', String(Math.max(1, Math.floor(weeks || 1))))
      formData.append('proof', proofFile)
      const res = await fetch('/api/tablette/rentals', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())
      setProofFile(null)
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Envoi impossible')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <h1 className="text-2xl font-semibold">Paiement tablette par virement</h1>
        <p className="mt-1 text-sm text-white/70">Numéro de téléphone : <span className="font-semibold">{TABLET_PHONE}</span></p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">Groupe</label>
            <Input value={groupName} readOnly />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Prix semaine</label>
            <Input value={`${TABLET_WEEKLY_PRICE.toFixed(2)} $`} readOnly />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Nombre de semaines</label>
            <QuantityStepper value={weeks} onChange={setWeeks} min={1} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Montant total</label>
            <Input value={`${amount.toFixed(2)} $`} readOnly />
          </div>
          <ImageDropzone label="Preuve du virement (copier/coller ou PNG/JPEG)" onChange={setProofFile} />
        </div>

        <div className="mt-4 flex justify-end">
          <PrimaryButton onClick={() => void submit()} disabled={sending}>{sending ? 'Envoi…' : 'Envoyer la demande'}</PrimaryButton>
        </div>

        {error ? <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold">Mes preuves d’achat</h2>
        <div className="mt-3 space-y-2">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{ticket.weeks} semaine(s) · {ticket.amount.toFixed(2)} $</span>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${ticket.status === 'resolved' ? 'border-emerald-300/35 bg-emerald-500/20 text-emerald-100' : 'border-amber-300/35 bg-amber-500/20 text-amber-100'}`}>
                  {ticket.status === 'resolved' ? 'Validé' : 'Pris en compte'}
                </span>
              </div>
              {ticket.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ticket.image_url} alt="Preuve" className="mt-2 h-24 w-auto rounded-lg border border-white/10 object-cover" />
              ) : null}
            </div>
          ))}
          {tickets.length === 0 ? <p className="text-sm text-white/60">Aucune demande pour le moment.</p> : null}
        </div>
      </Panel>
    </div>
  )
}
