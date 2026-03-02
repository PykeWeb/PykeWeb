'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Factory, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { listDrugItems, adjustDrugStock, updateDrugItem, deleteDrugItem, type DbDrugItem, type DrugKind } from '@/lib/drugsApi'
import { ImageDropzone } from '@/components/objets/ImageDropzone'

const TAB_KEYS = ['catalogue', 'plantations'] as const
type TabKey = (typeof TAB_KEYS)[number]

function kindLabel(k: DrugKind) {
  switch (k) {
    case 'drug':
      return 'Drogue'
    case 'seed':
      return 'Graine'
    case 'planting':
      return 'Plantation'
    case 'pouch':
      return 'Pochon'
    case 'other':
      return 'Autre'
    default:
      return 'Autre'
  }
}

type Recipe = {
  key: string
  title: string
  subtitle: string
  requirements: { name: string; qty: number }[]
  output: { name: string; qty: number; range?: [number, number] }
  note?: string
}

const RECIPES: Recipe[] = [
  {
    key: 'coke_leaf',
    title: 'Plantation coke (1 pot)',
    subtitle: '1 pot + 1 graine + 1 engrais + 3 eau = 1 feuille',
    requirements: [
      { name: 'Pot', qty: 1 },
      { name: 'Graine de coke', qty: 1 },
      { name: 'Engrais', qty: 1 },
      { name: 'Eau', qty: 3 },
    ],
    output: { name: 'Feuille de coke', qty: 1 },
    note: 'Stacks RP : 9 pots par stack + 2 lampes UV (par stack). Le calcul ci-dessus est “par pot”.',
  },
  {
    key: 'meth_brut',
    title: 'Cook meth (1 batch)',
    subtitle: 'Table + Meth + Batteries + chimie = 10 à 30 meth brut',
    requirements: [
      { name: 'Table', qty: 1 },
      { name: 'Meth', qty: 1 },
      { name: 'Batterie', qty: 2 },
      { name: 'Ammoniaque', qty: 16 },
      { name: 'Methylamine', qty: 15 },
    ],
    output: { name: 'Meth brut', qty: 0, range: [10, 30] },
    note: 'Output aléatoire : entre 10 et 30 meth brut par batch. (Tu peux ajuster plus tard si besoin.)',
  },
]

function findByKeyword(items: DbDrugItem[], keyword: string) {
  const k = keyword.toLowerCase()
  return items.filter((it) => (it.name || '').toLowerCase().includes(k))
}

export default function DroguesClient() {
  const [tab, setTab] = useState<TabKey>('catalogue')
  const [items, setItems] = useState<DbDrugItem[]>([])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<DrugKind | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editingItem, setEditingItem] = useState<DbDrugItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<DrugKind>('other')
  const [editPrice, setEditPrice] = useState('')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      setItems(await listDrugItems())
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
    let arr = items
    if (kind !== 'all') arr = arr.filter((it) => it.type === kind)
    const q = query.trim().toLowerCase()
    if (!q) return arr
    return arr.filter((o) => (o.name || '').toLowerCase().includes(q))
  }, [items, query, kind])

  const possibleBatches = useMemo(() => {
    const res: Record<string, number> = {}
    for (const r of RECIPES) {
      const limits: number[] = []
      for (const req of r.requirements) {
        const matches = findByKeyword(items, req.name)
        const totalStock = matches.reduce((sum, it) => sum + (it.stock || 0), 0)
        limits.push(Math.floor(totalStock / req.qty))
      }
      res[r.key] = limits.length ? Math.max(0, Math.min(...limits)) : 0
    }
    return res
  }, [items])

  const producedCokeLeaves = useMemo(() => {
    const list = findByKeyword(items, 'Feuille de coke')
    return list.reduce((sum, it) => sum + Number(it.stock || 0), 0)
  }, [items])

  const producedMethBrut = useMemo(() => {
    const list = findByKeyword(items, 'Meth brut')
    return list.reduce((sum, it) => sum + Number(it.stock || 0), 0)
  }, [items])

  function startEdit(item: DbDrugItem) {
    setEditingItem(item)
    setEditName(item.name || '')
    setEditType(item.type)
    setEditPrice(String(item.price ?? 0))
    setEditImageFile(null)
    setError(null)
  }

  function cancelEdit() {
    setEditingItem(null)
    setEditName('')
    setEditType('other')
    setEditPrice('')
    setEditImageFile(null)
  }

  async function saveEdit() {
    if (!editingItem) return
    if (!editName.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    if (Number.isNaN(Number(editPrice)) || Number(editPrice) < 0) {
      setError('Le prix doit être un nombre positif.')
      return
    }

    try {
      setSavingEdit(true)
      setError(null)
      await updateDrugItem({
        id: editingItem.id,
        type: editType,
        name: editName.trim(),
        price: Number(editPrice),
        imageFile: editImageFile,
      })
      await refresh()
      cancelEdit()
    } catch (e: any) {
      setError(e?.message || 'Erreur modification')
    } finally {
      setSavingEdit(false)
    }
  }

  async function removeItem(item: DbDrugItem) {
    if (!window.confirm(`Supprimer définitivement "${item.name}" ?`)) return
    try {
      setError(null)
      await deleteDrugItem(item.id)
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Erreur suppression')
    }
  }

  async function produce(recipe: Recipe) {
    const batches = possibleBatches[recipe.key] ?? 0
    if (batches <= 0) return

    setError(null)
    setBusyId(recipe.key)

    try {
      for (const req of recipe.requirements) {
        let remaining = req.qty
        const matches = findByKeyword(items, req.name).sort((a, b) => (b.stock || 0) - (a.stock || 0))
        for (const it of matches) {
          if (remaining <= 0) break
          const take = Math.min(it.stock || 0, remaining)
          if (take > 0) {
            await adjustDrugStock({ itemId: it.id, delta: -take, note: `Production: ${recipe.title}` })
            remaining -= take
          }
        }
      }

      const outMatches = findByKeyword(items, recipe.output.name)
      if (outMatches.length === 0) {
        throw new Error(`Crée l'item output “${recipe.output.name}” dans le catalogue pour recevoir la production.`)
      }
      const delta = recipe.output.range
        ? Math.floor(Math.random() * (recipe.output.range[1] - recipe.output.range[0] + 1)) + recipe.output.range[0]
        : recipe.output.qty

      await adjustDrugStock({
        itemId: outMatches[0].id,
        delta,
        note: `Production: ${recipe.title}`,
      })

      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Erreur')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('catalogue')}
              className={
                'rounded-xl border px-3 py-2 text-sm font-semibold shadow-glow transition ' +
                (tab === 'catalogue' ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10')
              }
            >
              Catalogue
            </button>
            <button
              onClick={() => setTab('plantations')}
              className={
                'rounded-xl border px-3 py-2 text-sm font-semibold shadow-glow transition ' +
                (tab === 'plantations' ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10')
              }
            >
              Plantations
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/drogues/nouveau" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium shadow-glow transition hover:bg-white/10">
              Ajouter un item
            </Link>
          </div>
        </div>

        {tab === 'catalogue' ? (
          <>
            {editingItem ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Modifier l’item : {editingItem.name}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={saveEdit}
                      className="rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-white/60">Nom</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60">Type</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as DrugKind)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/20"
                    >
                      <option value="drug">Drogue</option>
                      <option value="seed">Graine</option>
                      <option value="planting">Plantation</option>
                      <option value="pouch">Pochon</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/60">Prix</label>
                    <input
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      inputMode="decimal"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/20"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs text-white/60">Image actuelle</p>
                  <div className="mt-1 h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    {editingItem.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={editingItem.image_url} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                </div>

                <ImageDropzone label="Remplacer l’image (optionnel)" onChange={setEditImageFile} />
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-[260px] rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
                placeholder="Rechercher…"
              />

              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20"
              >
                <option value="all">Tous</option>
                <option value="drug">Drogue</option>
                <option value="seed">Graine</option>
                <option value="planting">Plantation</option>
                <option value="pouch">Pochons / vente</option>
                <option value="other">Autre</option>
              </select>

              <div className="text-xs text-white/60">{filtered.length} item(s)</div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-white/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Prix</th>
                    <th className="px-4 py-3 text-left font-medium">Stock</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-white/60">
                        Chargement…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-white/60">
                        Aucun item pour le moment.
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
                        <td className="px-4 py-3">{kindLabel(it.type)}</td>
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
                                  await adjustDrugStock({ itemId: it.id, delta: 1, note: 'Entrée' })
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
                                  await adjustDrugStock({ itemId: it.id, delta: -1, note: 'Sortie' })
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
                            <button onClick={() => startEdit(it)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium shadow-glow transition hover:bg-white/10">
                              <Pencil className="h-4 w-4" />
                              Modifier
                            </button>
                            <button onClick={() => removeItem(it)} className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20">
                              <Trash2 className="h-4 w-4" />
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4">
              <DraggablePlantations
                producedCokeLeaves={producedCokeLeaves}
                producedMethBrut={producedMethBrut}
                recipes={RECIPES}
                possibleBatches={possibleBatches}
                busyId={busyId}
                onProduce={produce}
              />
            </div>
          </>
        )}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            ❌ {error}
          </div>
        ) : null}
      </Panel>
    </div>
  )
}

function DraggablePlantations({
  producedCokeLeaves,
  producedMethBrut,
  recipes,
  possibleBatches,
  busyId,
  onProduce
}: {
  producedCokeLeaves: number
  producedMethBrut: number
  recipes: Recipe[]
  possibleBatches: Record<string, number>
  busyId: string | null
  onProduce: (recipe: Recipe) => Promise<void>
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2">
          <Factory className="h-4 w-4 text-white/80" />
          <p className="text-sm font-semibold">Production en stock</p>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <span>Feuille de coke</span>
            <span className="font-semibold">{producedCokeLeaves}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <span>Meth brut</span>
            <span className="font-semibold">{producedMethBrut}</span>
          </div>
        </div>
      </div>

      {recipes.map((r) => {
        const canDo = (possibleBatches[r.key] ?? 0) > 0
        return (
          <div key={r.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold">{r.title}</p>
            <p className="mt-1 text-xs text-white/60">{r.subtitle}</p>

            <div className="mt-3 space-y-1 text-xs text-white/70">
              {r.requirements.map((req) => (
                <div key={req.name} className="flex items-center justify-between">
                  <span>{req.name}</span>
                  <span>× {req.qty}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
              Output : {r.output.name}{' '}
              {r.output.range ? `(${r.output.range[0]} à ${r.output.range[1]})` : `× ${r.output.qty}`}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-white/60">Batches possibles : {possibleBatches[r.key] ?? 0}</span>
              <button
                disabled={!canDo || busyId === r.key}
                onClick={() => onProduce(r)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium shadow-glow transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Produire
              </button>
            </div>

            {r.note ? <p className="mt-2 text-[11px] text-white/50">{r.note}</p> : null}
          </div>
        )
      })}
    </div>
  )
}
