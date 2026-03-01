'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, Factory, Plus } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { useUiSettings } from '@/lib/useUiSettings'
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

type PlantModuleId = 'production' | 'coke_leaf' | 'meth_brut'

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
  const { layouts, setLayout, t } = useUiSettings()
  const defaultPlantOrder: PlantModuleId[] = ['production', 'coke_leaf', 'meth_brut']
  const [plantOrder, setPlantOrder] = useState<PlantModuleId[]>(defaultPlantOrder)
  const [draggingPlant, setDraggingPlant] = useState<PlantModuleId | null>(null)

  useEffect(() => {
    const saved = layouts?.['drogues.plantationsOrder']
    if (Array.isArray(saved)) {
      const clean = saved.filter((x): x is PlantModuleId => defaultPlantOrder.includes(x))
      const merged = Array.from(new Set([...clean, ...defaultPlantOrder])) as PlantModuleId[]
      setPlantOrder(merged)
    } else {
      setPlantOrder(defaultPlantOrder)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layouts?.['drogues.plantationsOrder']])

  const handlePlantDragStart = (id: PlantModuleId) => {
    setDraggingPlant(id)
  }

  const handlePlantDropOn = async (target: PlantModuleId) => {
    if (!draggingPlant || draggingPlant === target) return
    setPlantOrder((prev) => {
      const next = [...prev]
      const from = next.indexOf(draggingPlant)
      const to = next.indexOf(target)
      if (from === -1 || to === -1) return prev
      next.splice(from, 1)
      next.splice(to, 0, draggingPlant)
      return next
    })
    setDraggingPlant(null)
  }

  useEffect(() => {
    // save after changes
    ;(async () => {
      try {
        await setLayout('drogues.plantationsOrder', plantOrder)
      } catch {
        // ignore (missing table / RLS). On garde l'ordre en mémoire.
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantOrder])

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


const itemIndex = useMemo(() => {
  const m = new Map<string, DbDrugItem>()
  for (const it of items) {
    if (it.name) m.set(it.name.toLowerCase(), it)
  }
  return m
}, [items])

const renderItemLine = (name: string, qty: number) => {
  const key = (name || '').toLowerCase()
  const direct = itemIndex.get(key)
  const fallback = findByKeyword(items, name)[0]
  const it = direct || fallback

  const img =
    (it as any)?.image_url ??
    (it as any)?.imageUrl ??
    null

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-white/40">
              —
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-white/90">{name}</p>
          {it?.type ? <p className="text-xs text-white/50">{kindLabel(it.type)}</p> : null}
        </div>
      </div>

      <div className="text-sm font-semibold text-white/90">x{qty}</div>
    </div>
  )
}

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

    // Add output to first matching output item; if none exists, show a hint.
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

async function runProduction(recipeKey: Recipe['key'], times: number) {
  const recipe = RECIPES.find((r) => r.key === recipeKey)
  if (!recipe) return
  const count = Math.max(1, Math.min(10, times || 1))
  for (let i = 0; i < count; i++) {
    // eslint-disable-next-line no-await-in-loop
    await produce(recipe)
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
              <p className="text-sm text-white/70">{t('title.drogues.plantations', 'Plantations')}</p>
              <p className="mt-1 text-xs text-white/50">Tu peux glisser-déposer les modules pour réorganiser l’affichage (ordre sauvegardé pour ce groupe).</p>
            </div>

            <div className="mt-4 grid gap-4">
              {plantOrder.map((cardId) => {
                const common = {
                  draggable: true,
                  onDragStart: () => handlePlantDragStart(cardId),
                  onDragOver: (e: DragEvent<HTMLDivElement>) => e.preventDefault(),
                  onDrop: () => handlePlantDropOn(cardId),
                }

                if (cardId === 'production') {
                  return (
                    <div key={cardId} {...common} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white/90">
                          <Factory className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold">Production en stock</p>
                          <p className="text-xs text-white/60">Ce que tu as déjà produit (basé sur le nom exact des items).</p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-xs font-semibold text-white/80">Feuilles de coke</p>
                          <p className="mt-2 text-2xl font-semibold">{producedCokeLeaves}</p>
                          <p className="text-xs text-white/50">Basé sur l’item “Feuille de coke”.</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-xs font-semibold text-white/80">Meth brut</p>
                          <p className="mt-2 text-2xl font-semibold">{producedMethBrut}</p>
                          <p className="text-xs text-white/50">Basé sur l’item “Meth brut”.</p>
                        </div>
                      </div>
                    </div>
                  )
                }

                const recipe = RECIPES.find((r) => r.key === cardId)
                if (!recipe) return null
                const batches = possibleBatches[recipe.key] ?? 0

                return (
                  <div key={cardId} {...common} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white/90">
                          <Factory className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{recipe.title}</p>
                          <p className="text-xs text-white/60">{recipe.subtitle}</p>
                          {recipe.note ? <p className="mt-2 text-xs text-white/50">{recipe.note}</p> : null}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white/60">Batches possibles</p>
                        <p className="text-2xl font-semibold">{batches}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="mb-2 text-xs font-semibold text-white/80">Requis (par batch)</p>
                        <div className="space-y-2">
                          {recipe.requirements.map((it) => (
                            <div key={it.name}>{renderItemLine(it.name, it.qty)}</div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="mb-2 text-xs font-semibold text-white/80">Output</p>
                        <div className="space-y-2">
                          {recipe.output.range ? (
                            <div>{renderItemLine(recipe.output.name, recipe.output.range[0])}</div>
                          ) : (
                            <div>{renderItemLine(recipe.output.name, recipe.output.qty)}</div>
                          )}
                          {recipe.output.range ? (
                            <p className="text-xs text-white/50">Output aléatoire : {recipe.output.range[0]} à {recipe.output.range[1]}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => runProduction(recipe.key, 1)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium shadow-glow transition hover:bg-white/10"
                      >
                        <ArrowDownLeft className="h-4 w-4" /> Produire x1
                      </button>
                      <button
                        onClick={() => runProduction(recipe.key, Math.min(5, batches || 0))}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium shadow-glow transition hover:bg-white/10"
                        disabled={batches <= 0}
                      >
                        <ArrowDownLeft className="h-4 w-4" /> Produire max (≤5)
                      </button>
                      <div className="ml-auto text-xs text-white/50">Glisse la carte pour la déplacer</div>
                    </div>
                  </div>
                )
              })}
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
