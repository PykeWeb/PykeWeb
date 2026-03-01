'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Boxes, FlaskConical, GripVertical, Leaf, Plus, Search, Settings2 } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { listDrugItems, adjustDrugStock, type DbDrugItem, type DrugKind } from '@/lib/drugsApi'

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
    try {
      const raw = localStorage.getItem('pyke:plantationsLayout:v1')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const clean = parsed.filter((x): x is PlantCardId => defaultPlantOrder.includes(x))
        // s'assurer que toutes les cartes existent
        const merged = Array.from(new Set([...clean, ...defaultPlantOrder])) as PlantCardId[]
        setPlantOrder(merged)
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('pyke:plantationsLayout:v1', JSON.stringify(plantOrder))
    } catch {
      // ignore
    }
  }, [plantOrder])

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

  const itemByName = useMemo(() => {
    const m = new Map<string, Item>()
    for (const it of items) m.set(it.name.toLowerCase(), it)
    return m
  }, [items])

  const getItem = (name: string) => itemByName.get(name.toLowerCase())


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


  async function produce(recipe: Recipe) {
    const batches = possibleBatches[recipe.key] ?? 0
    if (batches <= 0) return

    setError(null)
    setBusyId(recipe.key)

    try {
      // Consume requirements (simple strategy: consume from first matching items)
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

      // Add output to first matching output item; if none exists, do nothing but show a hint.
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

  
  const handlePlantDragStart = (id: PlantCardId) => {
    setDraggingCard(id)
  }

  const handlePlantDropOn = (targetId: PlantCardId) => {
    setPlantOrder((prev) => {
      if (!draggingCard || draggingCard === targetId) return prev
      const next = [...prev]
      const from = next.indexOf(draggingCard)
      const to = next.indexOf(targetId)
      if (from === -1 || to === -1) return prev
      next.splice(from, 1)
      next.splice(to, 0, draggingCard)
      return next
    })
    setDraggingCard(null)
  }

  const plantCardClass =
    'group relative rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm'

  const renderItemLine = (name: string, qty: number) => {
    const it = getItem(name)
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-black/20">
            {it?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full" />
            )}
          </div>
          <div className="truncate">{name}</div>
        </div>
        <div className="tabular-nums text-white/80">x{qty}</div>
      </div>
    )
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
                    <th className="px-4 py-3 text-right font-medium">Stock</th>
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
                              <ArrowDownLeft className="h-4 w-4" />
                              +
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
                              -
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
  <div className="grid gap-4 md:grid-cols-2">
    {plantOrder.map((cardId) => {
      const commonProps = {
        draggable: true,
        onDragStart: () => handlePlantDragStart(cardId),
        onDragOver: (e) => e.preventDefault(),
        onDrop: () => handlePlantDropOn(cardId),
        className:
          plantCardClass +
          ' cursor-grab active:cursor-grabbing ' +
          (draggingCard === cardId ? ' ring-2 ring-white/20' : ''),
      }

      if (cardId === 'prod_coke') {
        return (
          <div key={cardId} {...commonProps}>
            <div className="absolute right-3 top-3 opacity-60 transition group-hover:opacity-100">
              <GripVertical className="h-4 w-4" />
            </div>
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/10">
                <Leaf className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-white/70">Production en stock</p>
                <p className="mt-1 truncate text-lg font-semibold">Feuilles de coke : {producedCokeLeaves}</p>
                <p className="mt-1 text-xs text-white/60">Basé sur l'item "Feuille de coke" dans ton catalogue.</p>
              </div>
            </div>
          </div>
        )
      }

      if (cardId === 'prod_meth') {
        return (
          <div key={cardId} {...commonProps}>
            <div className="absolute right-3 top-3 opacity-60 transition group-hover:opacity-100">
              <GripVertical className="h-4 w-4" />
            </div>
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/10">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-white/70">Production en stock</p>
                <p className="mt-1 truncate text-lg font-semibold">Meth brut : {producedMethBrut}</p>
                <p className="mt-1 text-xs text-white/60">Basé sur l'item "Meth brut" dans ton catalogue.</p>
              </div>
            </div>
          </div>
        )
      }

      const recipe = cardId === 'recipe_coke' ? RECIPES.find((r) => r.key === 'coke') : RECIPES.find((r) => r.key === 'meth')
      if (!recipe) return null
      const batches = possibleBatches[recipe.key] ?? 0
      const isCoke = recipe.key === 'coke'

      return (
        <div key={cardId} {...commonProps}>
          <div className="absolute right-3 top-3 opacity-60 transition group-hover:opacity-100">
            <GripVertical className="h-4 w-4" />
          </div>

          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/10">
              {isCoke ? <Leaf className="h-5 w-5" /> : <FlaskConical className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-white/70">{isCoke ? 'Plantation coke' : 'Cook meth'} ({recipe.key === 'coke' ? '1 pot' : '1 batch'})</p>
                  <p className="mt-1 truncate text-base font-semibold">{recipe.title}</p>
                  <p className="mt-1 text-xs text-white/60">{recipe.subtitle}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/60">Batches possibles</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{batches}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-2 text-xs font-semibold text-white/80">Requis (par batch)</p>
                  <div className="space-y-2">
                    {recipe.inputs.map((it) => (
                      <div key={it.name}>{renderItemLine(it.name, it.qty)}</div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-2 text-xs font-semibold text-white/80">Output</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-black/20">
                          {getItem(recipe.output.name)?.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getItem(recipe.output.name)!.image_url!}
                              alt={recipe.output.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full" />
                          )}
                        </div>
                        <div className="truncate">{recipe.output.name}</div>
                      </div>
                      <div className="tabular-nums text-white/80">
                        {recipe.output.range ? `+${recipe.output.range[0]} à +${recipe.output.range[1]}` : `+${recipe.output.qty}`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  disabled={busyId === recipe.key || batches <= 0}
                  onClick={() => produce(recipe)}
                  className={
                    'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-glow transition ' +
                    (batches > 0 ? 'bg-white text-black hover:bg-white/90' : 'bg-white/20 text-white/50')
                  }
                >
                  <Plus className="h-4 w-4" />
                  Produire 1 batch
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    })}
  </div>

  <p className="mt-3 text-xs text-white/50">
    Astuce : tu peux <span className="text-white/70">glisser-déposer</span> les cartes pour changer l'ordre (c'est enregistré sur ton navigateur).
  </p>
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
