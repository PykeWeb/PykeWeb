'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, ShoppingCart, ArrowUpRight } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { listEquipment, adjustEquipmentStock, updateEquipment, deleteEquipment, type DbEquipment } from '@/lib/equipmentApi'

export default function EquipementClient() {
  const [items, setItems] = useState<DbEquipment[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      setItems(await listEquipment())
    } catch (e: any) {
      setError(e?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((o) => (o.name || '').toLowerCase().includes(q))
  }, [items, query])

  const total = filtered.length

  async function quickEdit(item: DbEquipment) {
    const nextName = window.prompt('Nom :', item.name || '')
    if (nextName === null || !nextName.trim()) return
    const nextPrice = window.prompt('Prix :', String(item.price ?? 0))
    if (nextPrice === null) return
    if (Number.isNaN(Number(nextPrice)) || Number(nextPrice) < 0) {
      setError('Le prix doit être un nombre positif.')
      return
    }
    const nextDescription = window.prompt('Description (optionnel) :', item.description || '')
    if (nextDescription === null) return

    try {
      setError(null)
      await updateEquipment({
        id: item.id,
        name: nextName.trim(),
        price: Number(nextPrice),
        description: nextDescription.trim() || null,
      })
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Erreur modification')
    }
  }

  async function removeItem(item: DbEquipment) {
    if (!window.confirm(`Supprimer définitivement "${item.name}" ?`)) return
    try {
      setError(null)
      await deleteEquipment(item.id)
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Erreur suppression')
    }
  }


  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold">Catalogue</button>
            </div>
            <p className="mt-2 text-xs text-white/60">Astuce : “Achat” = entrer du stock, “Sortie” = retirer (vente / perte / transfert).</p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/equipement/nouveau" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium shadow-glow transition hover:bg-white/10">
              Ajouter un équipement
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-[260px] rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
            placeholder="Rechercher…"
          />
          <div className="text-xs text-white/60">{total} équipement(s)</div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-white/70">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Équipement</th>
                <th className="px-4 py-3 text-left font-medium">Prix</th>
                <th className="px-4 py-3 text-left font-medium">Stock</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-white/60">
                    Chargement…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-white/60">
                    Aucun équipement pour le moment.
                  </td>
                </tr>
              ) : (
                filtered.map((it) => (
                  <tr key={it.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                          {it.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div>
                          <div className="font-semibold">{it.name}</div>
                          {it.description ? <div className="text-xs text-white/60 line-clamp-1">{it.description}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{Number(it.price).toFixed(2)} $</td>
                    <td className="px-4 py-3">{it.stock}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={busyId === it.id}
                          onClick={async () => {
                            setBusyId(it.id)
                            setError(null)
                            try {
                              await adjustEquipmentStock({ equipmentId: it.id, delta: 1, note: 'Achat' })
                              await refresh()
                            } catch (e: any) {
                              setError(e?.message || 'Erreur')
                            } finally {
                              setBusyId(null)
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium shadow-glow transition hover:bg-white/10"
                        >
                          <ShoppingCart className="h-4 w-4" />
                          Achat
                        </button>
                        <button
                          disabled={busyId === it.id}
                          onClick={async () => {
                            setBusyId(it.id)
                            setError(null)
                            try {
                              await adjustEquipmentStock({ equipmentId: it.id, delta: -1, note: 'Sortie' })
                              await refresh()
                            } catch (e: any) {
                              setError(e?.message || 'Erreur')
                            } finally {
                              setBusyId(null)
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium shadow-glow transition hover:bg-white/10"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                          Sortie
                        </button>
                        <button onClick={() => quickEdit(it)} className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium shadow-glow transition hover:bg-white/10">Modifier</button>
                        <button onClick={() => removeItem(it)} className="inline-flex items-center rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20">Supprimer</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            ❌ {error}
          </div>
        ) : null}
      </Panel>
    </div>
  )
}
