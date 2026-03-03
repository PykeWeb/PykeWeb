/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { listObjects, type DbObject } from '@/lib/objectsApi'
import { createTransaction, type TxType, type TxLineInput } from '@/lib/transactionsApi'
import { Minus, Plus, Search, Trash2 } from 'lucide-react'

function money(n: number) {
  return `${n.toFixed(2)} $`
}

export default function TransactionBuilder({ type }: { type: TxType }) {
  const [objects, setObjects] = useState<DbObject[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // lines keyed by object id
  const [lines, setLines] = useState<Record<string, { obj: DbObject; qty: number }>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const data = await listObjects()
        if (!cancelled) setObjects(data)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Erreur de chargement des objets')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return objects
    return objects.filter((o) => o.name.toLowerCase().includes(q))
  }, [objects, query])

  const selected = useMemo(() => Object.values(lines), [lines])

  const total = useMemo(() => {
    return selected.reduce((acc, l) => acc + (l.obj.price ?? 0) * l.qty, 0)
  }, [selected])

  function addOne(obj: DbObject) {
    setSuccess(null)
    setError(null)
    setLines((prev) => {
      const cur = prev[obj.id]
      const nextQty = (cur?.qty ?? 0) + 1
      return { ...prev, [obj.id]: { obj, qty: nextQty } }
    })
  }

  function subOne(obj: DbObject) {
    setSuccess(null)
    setError(null)
    setLines((prev) => {
      const cur = prev[obj.id]
      if (!cur) return prev
      const nextQty = cur.qty - 1
      if (nextQty <= 0) {
        const { [obj.id]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [obj.id]: { obj, qty: nextQty } }
    })
  }

  function remove(objId: string) {
    setSuccess(null)
    setError(null)
    setLines((prev) => {
      const { [objId]: _, ...rest } = prev
      return rest
    })
  }

  async function onValidate() {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const txLines: TxLineInput[] = selected.map((l) => ({
        object: l.obj,
        quantity: l.qty,
        unit_price: l.obj.price ?? 0,
      }))

      const { total: savedTotal } = await createTransaction({
        type,
        counterparty: counterparty.trim() || null,
        notes: notes.trim() || null,
        lines: txLines,
      })

      setSuccess(
        type === 'purchase'
          ? `Achat enregistré. Total: ${money(Number(savedTotal ?? 0))}`
          : 'Sortie enregistrée. Stock mis à jour.'
      )
      setLines({})
      setQuery('')
      setCounterparty('')
      setNotes('')
      // refresh objects (stock changes)
      const data = await listObjects()
      setObjects(data)
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors de la validation')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Picker */}
      <div className="lg:col-span-1">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-glow">
          <p className="text-sm font-semibold text-white/90">Catalogue</p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <Search className="h-4 w-4 text-white/50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un objet…"
              className="w-full bg-transparent text-sm text-white/90 outline-none placeholder:text-white/40"
            />
          </div>

          <div className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-white/10">
            {loading ? (
              <div className="p-3 text-sm text-white/60">Chargement…</div>
            ) : filtered.length === 0 ? (
              <div className="p-3 text-sm text-white/60">Aucun objet.</div>
            ) : (
              <ul className="divide-y divide-white/10">
                {filtered.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 p-3 hover:bg-white/5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                        {o.image_url ? (
                          <img src={o.image_url} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white/90">{o.name}</p>
                        <p className="text-xs text-white/60">
                          {money(Number(o.price ?? 0))} • stock: {o.stock}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => addOne(o)}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/90 hover:bg-white/10"
                      title="Ajouter"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-3 text-xs text-white/50">
            Astuce : clique sur + pour ajouter. Tu gères ensuite les quantités à droite.
          </p>
        </div>
      </div>

      {/* Cart */}
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
          <p className="text-sm font-semibold text-white/90">
            {type === 'purchase' ? 'Achat (entrée stock)' : 'Sortie (vente / transfert)'}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-white/60">Interlocuteur (optionnel)</label>
              <input
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder={type === 'purchase' ? 'Nom du vendeur / joueur…' : 'Nom du groupe acheteur…'}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/40"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Notes (optionnel)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: payé en cash, deal, etc."
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/40"
              />
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="px-4 py-3 text-left">Objet</th>
                  <th className="px-4 py-3 text-right">PU</th>
                  <th className="px-4 py-3 text-center">Qté</th>
                  <th className="px-4 py-3 text-right">Sous-total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {selected.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-white/60" colSpan={5}>
                      Ajoute des objets depuis le catalogue à gauche.
                    </td>
                  </tr>
                ) : (
                  selected.map(({ obj, qty }) => {
                    const sub = (obj.price ?? 0) * qty
                    const disabledMinus = qty <= 1
                    const disabledPlus = type === 'sale' && qty >= (obj.stock ?? 0)
                    return (
                      <tr key={obj.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                              {obj.image_url ? <img src={obj.image_url} alt="" className="h-full w-full object-cover" /> : null}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-white/90">{obj.name}</p>
                              <p className="text-xs text-white/60">stock: {obj.stock}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-white/80">{money(Number(obj.price ?? 0))}</td>
                        <td className="px-4 py-3">
                          <div className="mx-auto flex w-fit items-center gap-2">
                            <button
                              onClick={() => subOne(obj)}
                              disabled={disabledMinus}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 disabled:opacity-40"
                              title="-1"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-8 text-center text-white/90">{qty}</span>
                            <button
                              onClick={() => addOne(obj)}
                              disabled={disabledPlus}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 disabled:opacity-40"
                              title={type === 'sale' ? 'Max = stock' : '+1'}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-white/90">{money(sub)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => remove(obj.id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/90 hover:bg-white/10"
                            title="Supprimer la ligne"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col items-end gap-2">
            <div className="text-sm text-white/70">
              Total estimé ({type === 'purchase' ? 'à payer' : 'valeur interne'}) :
            </div>
            <div className="text-2xl font-semibold text-white/90">{money(total)}</div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-white/50">
              {type === 'purchase'
                ? 'Valider = ajoute au stock + crée une transaction.'
                : 'Valider = retire du stock + crée une transaction.'}
            </p>
            <button
              onClick={onValidate}
              disabled={saving || selected.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm text-white/90 shadow-glow hover:bg-white/10 disabled:opacity-40"
            >
              {saving ? 'Validation…' : 'Valider'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
