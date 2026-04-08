'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { PrimaryButton } from '@/components/ui/design-system'
import { createFinanceTransaction, listCatalogItemsStockLite } from '@/lib/itemsApi'

export default function CashPayePage() {
  const [members, setMembers] = useState<string[]>([])
  const [member, setMember] = useState('')
  const [amount, setAmount] = useState('0')
  const [note, setNote] = useState('')
  const [cashAmount, setCashAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true)
        const [catalogRows, memberRes] = await Promise.all([
          listCatalogItemsStockLite(),
          fetch('/api/group/members', { cache: 'no-store' }),
        ])
        const cashItem = catalogRows.find((row) => String(row.name || '').trim().toLowerCase() === 'argent')
        setCashAmount(Math.max(0, Number(cashItem?.stock || 0)))
        if (memberRes.ok) {
          const payload = (await memberRes.json()) as { members?: string[] }
          const list = Array.isArray(payload.members) ? payload.members : []
          setMembers(list)
          if (list.length > 0) setMember(list[0])
        }
      } catch {
        toast.error('Impossible de charger la page paye.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const numericAmount = useMemo(() => Math.max(0, Math.floor(Number(amount || 0) || 0)), [amount])

  async function payMember() {
    if (!member.trim()) return toast.error('Choisis un membre.')
    if (numericAmount <= 0) return toast.error('Montant invalide.')
    if (numericAmount > cashAmount) return toast.error('Pas assez de cash.')
    try {
      setSaving(true)
      const catalogRows = await listCatalogItemsStockLite()
      const cashItem = catalogRows.find((row) => String(row.name || '').trim().toLowerCase() === 'argent')
      if (!cashItem?.id) throw new Error('Item argent introuvable.')
      await createFinanceTransaction({
        item_id: cashItem.id,
        mode: 'sell',
        quantity: numericAmount,
        unit_price: 1,
        counterparty: member.trim(),
        notes: `Paye membre${note.trim() ? ` • ${note.trim()}` : ''}`,
        payment_mode: 'cash',
      })
      setCashAmount((prev) => Math.max(0, prev - numericAmount))
      setAmount('0')
      setNote('')
      toast.success('Paye enregistrée.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Paye impossible.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Paye membres" subtitle="Verse un montant à un membre, débité du cash groupe." />
      <Panel>
        {loading ? <p className="text-sm text-white/70">Chargement…</p> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-xs text-white/70">
            <span>Membre</span>
            <select value={member} onChange={(event) => setMember(event.target.value)} className="h-11 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 text-sm text-white outline-none">
              {members.map((entry) => <option key={entry} value={entry} className="bg-[#0b1228]">{entry}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-white/70">
            <span>Montant</span>
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" />
          </label>
          <label className="space-y-1 text-xs text-white/70 md:col-span-2">
            <span>Note (optionnel)</span>
            <Input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-100">Cash disponible: <span className="font-semibold">{cashAmount.toLocaleString('fr-FR')} $</span></p>
          <PrimaryButton disabled={saving || loading} onClick={() => void payMember()}>
            {saving ? 'Paiement…' : 'Payer'}
          </PrimaryButton>
        </div>
      </Panel>
    </div>
  )
}
