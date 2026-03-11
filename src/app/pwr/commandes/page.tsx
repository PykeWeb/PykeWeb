'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { createPwrCheckpoint, createPwrOrder, listPwrCheckpoints, listPwrOrders, toErrorMessage } from '@/lib/pwrApi'
import { getTenantSession } from '@/lib/tenantSession'
import type { PwrOrder, PwrOrderCheckpoint } from '@/lib/types/pwr'

function toPositiveInt(value: string, fallback: number) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(1, Math.floor(num))
}

export default function PwrCommandesPage() {
  const [orders, setOrders] = useState<PwrOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrderId, setSelectedOrderId] = useState<string>('')
  const [checkpoints, setCheckpoints] = useState<PwrOrderCheckpoint[]>([])
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(false)

  const [newTitle, setNewTitle] = useState('Commande bidons essence')
  const [newTarget, setNewTarget] = useState('3000')
  const [newTruck, setNewTruck] = useState('475')

  const [deliveredQty, setDeliveredQty] = useState('0')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [isPwr, setIsPwr] = useState(false)

  const refreshOrders = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listPwrOrders()
      setOrders(rows)
      if (!selectedOrderId && rows.length > 0) setSelectedOrderId(rows[0].id)
      if (selectedOrderId && !rows.some((row) => row.id === selectedOrderId)) {
        setSelectedOrderId(rows[0]?.id || '')
      }
    } catch (error: unknown) {
      toast.error(toErrorMessage(error, 'Impossible de charger les commandes PWR.'))
    } finally {
      setLoading(false)
    }
  }, [selectedOrderId])

  useEffect(() => {
    const session = getTenantSession()
    const scope = `${session?.groupName || ''} ${session?.groupBadge || ''}`.toLowerCase()
    const allowed = scope.includes('pwr')
    setIsPwr(allowed)
    if (allowed) void refreshOrders()
  }, [refreshOrders])

  useEffect(() => {
    if (!selectedOrderId) {
      setCheckpoints([])
      return
    }

    setLoadingCheckpoints(true)
    void listPwrCheckpoints(selectedOrderId)
      .then(setCheckpoints)
      .catch((error: unknown) => toast.error(toErrorMessage(error, 'Impossible de charger le suivi.')))
      .finally(() => setLoadingCheckpoints(false))
  }, [selectedOrderId])

  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId) || null, [orders, selectedOrderId])

  const summary = useMemo(() => {
    if (!selectedOrder) return null
    const target = Math.max(1, selectedOrder.target_qty)
    const delivered = Math.max(0, selectedOrder.delivered_qty)
    const capacity = Math.max(1, selectedOrder.truck_capacity)
    const remaining = Math.max(0, target - delivered)
    const tripsRemaining = Math.ceil(remaining / capacity)
    const progress = Math.min(100, Math.round((delivered / target) * 100))
    return { target, delivered, remaining, tripsRemaining, progress }
  }, [selectedOrder])

  return (
    <Panel>
      <h1 className="text-2xl font-semibold">PWR • Suivi commandes</h1>
      <p className="mt-1 text-sm text-white/65">Suis tes livraisons de bidons, ajoute des photos de preuve et garde un historique des allers/retours.</p>

      {!isPwr ? (
        <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">Cette page est réservée au groupe PWR.</p>
      ) : null}

      {isPwr ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-sm font-semibold">Nouvelle commande</p>
              <div className="mt-2 space-y-2">
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Titre" />
                <Input value={newTarget} onChange={(e) => setNewTarget(e.target.value)} inputMode="numeric" placeholder="Quantité cible" />
                <Input value={newTruck} onChange={(e) => setNewTruck(e.target.value)} inputMode="numeric" placeholder="Capacité camion" />
                <PrimaryButton
                  onClick={async () => {
                    setSaving(true)
                    try {
                      await createPwrOrder({
                        title: newTitle.trim() || 'Commande PWR',
                        targetQty: toPositiveInt(newTarget, 3000),
                        truckCapacity: toPositiveInt(newTruck, 475),
                        unitLabel: 'bidons',
                      })
                      toast.success('Commande créée.')
                      await refreshOrders()
                    } catch (error: unknown) {
                      toast.error(toErrorMessage(error, 'Impossible de créer la commande.'))
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving}
                  className="w-full"
                >
                  Créer
                </PrimaryButton>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-sm font-semibold">Commandes</p>
              {loading ? <p className="mt-2 text-sm text-white/60">Chargement...</p> : null}
              <div className="mt-2 max-h-[330px] space-y-2 overflow-y-auto pr-1">
                {orders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left ${selectedOrderId === order.id ? 'border-cyan-300/40 bg-cyan-500/12' : 'border-white/10 bg-white/[0.03]'}`}
                  >
                    <p className="text-sm font-semibold">{order.title}</p>
                    <p className="text-xs text-white/65">{order.delivered_qty} / {order.target_qty} {order.unit_label}</p>
                  </button>
                ))}
                {!loading && orders.length === 0 ? <p className="text-sm text-white/60">Aucune commande.</p> : null}
              </div>
            </div>
          </div>

          <div>
            {!selectedOrder ? <p className="text-sm text-white/60">Sélectionne une commande pour le suivi.</p> : null}
            {selectedOrder && summary ? (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-xs text-white/60">Progression</p><p className="text-xl font-semibold">{summary.progress}%</p></div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-xs text-white/60">Restant</p><p className="text-xl font-semibold">{summary.remaining}</p></div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-xs text-white/60">Allers restants</p><p className="text-xl font-semibold">{summary.tripsRemaining}</p></div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-sm font-semibold">Ajouter un point de suivi</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <Input value={deliveredQty} onChange={(e) => setDeliveredQty(e.target.value)} inputMode="numeric" placeholder="Quantité déposée actuellement" />
                    <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
                    <div className="md:col-span-2">
                      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (ex: palette déplacée / zone 2 / etc.)" />
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <PrimaryButton
                      onClick={async () => {
                        setSaving(true)
                        try {
                          await createPwrCheckpoint({
                            orderId: selectedOrder.id,
                            deliveredQty: Math.max(0, Number(deliveredQty) || 0),
                            note,
                            photo,
                          })
                          toast.success('Point de suivi ajouté.')
                          setPhoto(null)
                          setNote('')
                          await refreshOrders()
                          setLoadingCheckpoints(true)
                          const rows = await listPwrCheckpoints(selectedOrder.id)
                          setCheckpoints(rows)
                        } catch (error: unknown) {
                          toast.error(toErrorMessage(error, 'Impossible d\'ajouter le suivi.'))
                        } finally {
                          setSaving(false)
                          setLoadingCheckpoints(false)
                        }
                      }}
                      disabled={saving}
                    >
                      Enregistrer
                    </PrimaryButton>
                    <SecondaryButton onClick={() => { setDeliveredQty(String(selectedOrder.delivered_qty)); setNote(''); setPhoto(null) }}>Réinitialiser</SecondaryButton>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-sm font-semibold">Historique photo / notes</p>
                  {loadingCheckpoints ? <p className="mt-2 text-sm text-white/60">Chargement...</p> : null}
                  <div className="mt-2 max-h-[340px] space-y-2 overflow-y-auto pr-1">
                    {checkpoints.map((entry) => (
                      <div key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{entry.delivered_qty} bidons posés</p>
                          <p className="text-xs text-white/60">{new Date(entry.created_at).toLocaleString('fr-FR')}</p>
                        </div>
                        {entry.note ? <p className="mt-1 text-sm text-white/80">{entry.note}</p> : null}
                        {entry.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entry.photo_url} alt="Photo suivi" className="mt-2 h-40 w-full rounded-lg border border-white/10 object-cover" />
                        ) : null}
                      </div>
                    ))}
                    {!loadingCheckpoints && checkpoints.length === 0 ? <p className="text-sm text-white/60">Aucun point de suivi.</p> : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Panel>
  )
}
