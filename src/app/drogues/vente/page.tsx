'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { createFinanceTransaction, listCatalogItemsUnified } from '@/lib/itemsApi'
import { getTenantSession } from '@/lib/tenantSession'
import type { CatalogItem } from '@/lib/types/itemsFinance'

export default function DroguesVentePage() {
  const MIN_ESTIMATED_POUCH_PRICE = 77
  const [items, setItems] = useState<CatalogItem[]>([])
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState(1)
  const [receivedTotalInput, setReceivedTotalInput] = useState(MIN_ESTIMATED_POUCH_PRICE)
  const [buyer, setBuyer] = useState('')
  const [member, setMember] = useState('')
  const [memberOptions, setMemberOptions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const sessionMember = String(getTenantSession()?.memberName || '').trim()
    if (sessionMember) setMember(sessionMember)

    void listCatalogItemsUnified()
      .then((rows) => {
        const pouches = rows.filter((row) => row.category === 'drugs' && row.is_active && row.item_type === 'pouch')
        setItems(pouches)
        if (pouches[0]) {
          setItemId(pouches[0].id)
          setReceivedTotalInput(Math.max(0, Number(pouches[0].sell_price || pouches[0].buy_price || MIN_ESTIMATED_POUCH_PRICE)))
        }
      })
      .catch(() => setItems([]))

    void fetch('/api/group/members', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return []
        const payload = (await res.json()) as { members?: string[] }
        return Array.isArray(payload.members) ? payload.members : []
      })
      .then((rows) => setMemberOptions(rows))
      .catch(() => setMemberOptions([]))
  }, [])

  const selected = useMemo(() => items.find((row) => row.id === itemId) || null, [itemId, items])
  const availableStock = Math.max(0, Number(selected?.stock || 0))
  const safeQty = Math.max(1, Math.floor(qty || 1))
  const estimatedTotal = safeQty * MIN_ESTIMATED_POUCH_PRICE
  const receivedTotal = Math.max(0, Number(receivedTotalInput || 0))

  useEffect(() => {
    if (!selected) return
    setReceivedTotalInput((prev) => (prev > 0 ? prev : Math.max(0, Number(selected.sell_price || selected.buy_price || MIN_ESTIMATED_POUCH_PRICE))))
    setQty((prev) => Math.max(1, Math.min(Math.floor(prev || 1), Math.max(1, Math.floor(Number(selected.stock || 0) || 0)))))
  }, [selected?.id])

  return (
    <div className="space-y-4">
      <PageHeader title="Vente Pochons" subtitle="Vendre des pochons, sortir du stock, et enregistrer l’argent reçu." />

      <Panel className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Pochon</span>
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm text-white">
              <option value="">Choisir un item</option>
              {items.map((row) => <option key={row.id} value={row.id}>{row.name} (stock {Math.max(0, Number(row.stock || 0))})</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Acheteur / interlocuteur</span>
            <Input value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Ex: Client du quartier" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Membre</span>
            <select value={member} onChange={(e) => setMember(e.target.value)} className="h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-sm text-white">
              <option value="">Choisir un joueur</option>
              {memberOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Quantité (stock: {availableStock})</span>
            <Input value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} inputMode="numeric" />
          </label>
          <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-3">
            <p className="text-xs text-white/70">Prix total estimé</p>
            <p className="text-xl font-semibold">{estimatedTotal.toFixed(2)} $</p>
          </div>
          <label className="space-y-1 text-sm">
            <span className="text-white/70">Prix total reçu</span>
            <Input value={receivedTotalInput} onChange={(e) => setReceivedTotalInput(Number(e.target.value) || 0)} inputMode="decimal" />
          </label>
          <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-3">
            <p className="text-xs text-white/70">Argent reçu (réel)</p>
            <p className="text-xl font-semibold">{receivedTotal.toFixed(2)} $</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={() => {
            if (!selected) return
            setQty(1)
            setReceivedTotalInput(MIN_ESTIMATED_POUCH_PRICE)
            setBuyer('')
          }}
          >
            Réinitialiser
          </SecondaryButton>
          <PrimaryButton
            icon={<ArrowUpRight className="h-4 w-4" />}
            disabled={saving || !selected || qty <= 0 || qty > availableStock}
            onClick={async () => {
              if (!selected) return
              try {
                setSaving(true)
                const notes = member.trim() ? `Membre: ${member.trim()}` : undefined
                await createFinanceTransaction({
                  item_id: selected.id,
                  mode: 'sell',
                  quantity: Math.max(1, Math.floor(qty || 1)),
                  unit_price: safeQty > 0 ? Math.max(0, Number(receivedTotal / safeQty)) : 0,
                  counterparty: buyer.trim() || undefined,
                  notes: `${notes ? `${notes} · ` : ''}Estimation min totale: ${estimatedTotal.toFixed(2)} $`,
                })
                toast.success('Vente enregistrée. Stock sorti et argent ajouté.')
                const refreshed = await listCatalogItemsUnified()
                const pouches = refreshed.filter((row) => row.category === 'drugs' && row.is_active && row.item_type === 'pouch')
                setItems(pouches)
              } catch (error: unknown) {
                toast.error(error instanceof Error ? error.message : 'Vente impossible.')
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? 'Validation…' : 'Valider la vente'}
          </PrimaryButton>
        </div>
      </Panel>
    </div>
  )
}
