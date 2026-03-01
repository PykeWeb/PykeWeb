'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Factory, Plus } from 'lucide-react'
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
    case 'supply':
      return 'Supply'
    case 'lab':
      return 'Lab'
    case 'output':
      return 'Output'
    default:
      return k
  }
}

type Recipe = {
  key: string
  title: string
  subtitle: string
  requirements: { name: string; qty: number }[]
  output: { name: string; qty: number }
  note?: string
}

const RECIPES: Recipe[] = [
  {
    key: 'coke_leaf',
    title: 'Plantation coca → feuilles',
    subtitle: 'Consomme graines/pots/engrais/eau + lampes UV',
    requirements: [
      // Stack de 9 pots
      { name: 'Graine', qty: 9 },
      { name: 'Pot', qty: 9 },
      { name: 'Engrais', qty: 9 },
      { name: 'Eau', qty: 27 },
      // 2 lampes UV par stack
      { name: 'Lampe UV', qty: 2 },
    ],
    // 1 pot = 1 feuille, donc stack de 9 → 9 feuilles
    output: { name: 'Feuille', qty: 9 },
    note: 'Le calcul est basé sur le stock des items qui contiennent ces mots dans leur nom.',
  },
  {
    key: 'meth_kit',
    title: 'Cuisine meth (kit)',
    subtitle: 'Recette “kit” (10 à 30 meth brut selon votre RP)',
    requirements: [
      { name: 'Table', qty: 1 },
      { name: 'Meth', qty: 1 },
      // 2 batteries (souvent demandé)
      { name: 'Batterie', qty: 2 },
      // 15 + 1 ammoniaque
      { name: 'Ammoniaque', qty: 16 },
      { name: 'Methylamine', qty: 15 },
    ],
    output: { name: 'Meth brut', qty: 10 },
    note: 'Le calcul se base sur des mots-clés. Crée les items (table, batteries, ammoniaque, methylamine) dans le catalogue pour que tout s’aligne.',
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
    refresh()
  }, [])

  const filtered = useMemo(() => {
    let arr = items
    if (kind !== 'all') arr = arr.filter((it) => it.kind === kind)
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

  const producedCounts = useMemo(() => {
    // Ce sont des “compteurs” pratiques : ce que vous avez déjà produit/stocké.
    const leaf = findByKeyword(items, 'feuille').reduce((sum, it) => sum + (it.stock || 0), 0)
    const methBrut = findByKeyword(items, 'meth brut').reduce((sum, it) => sum + (it.stock || 0), 0)
    return { leaf, methBrut }
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
      await adjustDrugStock({
        itemId: outMatches[0].id,
        delta: recipe.output.qty,
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
                <option value="supply">Supply</option>
                <option value="lab">Lab</option>
                <option value="output">Output</option>
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
                        <td className="px-4 py-3">{kindLabel(it.kind)}</td>
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
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs text-white/60">Feuilles de coke en stock</p>
                <p className="mt-1 text-2xl font-semibold">{producedCounts.leaf}</p>
                <p className="mt-1 text-xs text-white/50">Mot-clé: “feuille”</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs text-white/60">Meth brut en stock</p>
                <p className="mt-1 text-2xl font-semibold">{producedCounts.methBrut}</p>
                <p className="mt-1 text-xs text-white/50">Mot-clé: “meth brut”</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs text-white/60">Rappel</p>
                <p className="mt-2 text-sm text-white/70">
                  Les calculs utilisent des mots-clés dans les noms d’items. Ex: “Pot”, “Engrais”, “Lampe UV”, “Meth brut”.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {RECIPES.map((r) => {
                const batches = possibleBatches[r.key] ?? 0
                return (
                  <div key={r.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white/90">
                            <Factory className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{r.title}</p>
                            <p className="text-xs text-white/60">{r.subtitle}</p>
                          </div>
                        </div>
                        {r.note ? <p className="mt-3 text-xs text-white/50">{r.note}</p> : null}
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-white/60">Batches possibles</p>
                        <p className="mt-1 text-2xl font-semibold">{batches}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-xs font-semibold text-white/80">Requis (par batch)</p>
                        <ul className="mt-2 space-y-1 text-xs text-white/60">
                          {r.requirements.map((req) => (
                            <li key={req.name} className="flex items-center justify-between">
                              <span>{req.name}</span>
                              <span className="font-semibold text-white/70">x{req.qty}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-xs font-semibold text-white/80">Output</p>
                        <p className="mt-2 text-sm font-semibold">{r.output.name}</p>
                        <p className="text-xs text-white/60">+{r.output.qty}</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <p className="text-xs font-semibold text-white/80">Stock → batches</p>
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {r.requirements.map((req) => {
                          const matches = findByKeyword(items, req.name)
                          const totalStock = matches.reduce((sum, it) => sum + (it.stock || 0), 0)
                          const b = req.qty > 0 ? Math.floor(totalStock / req.qty) : 0
                          return (
                            <div key={req.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                              <span className="text-xs text-white/70">{req.name}</span>
                              <span className="text-xs font-semibold text-white/80">
                                {totalStock} → {b}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        disabled={busyId === r.key || batches <= 0}
                        onClick={() => produce(r)}
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
