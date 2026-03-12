'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Box, Image as ImageIcon, Pill, Shield, Swords, Shapes } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { DangerButton, PrimaryButton, SearchInput, SecondaryButton, TabPill } from '@/components/ui/design-system'
import { createFinanceTransaction, deleteCatalogItem, listCatalogItemsUnified } from '@/lib/itemsApi'
import type { CatalogItem, ItemCategory, ItemType } from '@/lib/types/itemsFinance'
import { copy } from '@/lib/copy'
import { buildDrugCalculatorResult, type DrugCalcMode } from '@/lib/drugCalculator'
import { getCategoryLabel, getTypeLabel } from '@/lib/catalogConfig'

type CategoryFilter = 'all' | ItemCategory
type TypeFilter = 'all' | ItemType
type ItemsView = 'catalog' | 'tools'

type PlantationRecipe = {
  key: string
  title: string
  subtitle: string
  requirements: { name: string; qty: number }[]
  output_name: string
  default_output_per_run: number
}

function normalizeItemName(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

const plantationRecipes: PlantationRecipe[] = [
  {
    key: 'coke-leaf',
    title: 'Plantation coke (1 pot)',
    subtitle: "1 pot + 1 graine + 1 fertilisant + 3 bouteilles d'eau = 1 feuille",
    requirements: [
      { name: 'Pot', qty: 1 },
      { name: 'Graine de coke', qty: 1 },
      { name: 'Fertilisant', qty: 1 },
      { name: "Bouteille d'eau", qty: 3 },
    ],
    output_name: 'Feuille de Cocaïne',
    default_output_per_run: 1,
  },
  {
    key: 'meth',
    title: 'Cook meth (1 batch)',
    subtitle: 'Table + meth + batteries + chimie = 10 à 30 meth brut',
    requirements: [
      { name: 'Table', qty: 1 },
      { name: 'Machine de Meth', qty: 1 },
      { name: 'Batterie', qty: 2 },
      { name: 'Ammoniaque', qty: 16 },
      { name: 'Methylamine', qty: 15 },
    ],
    output_name: 'Meth brut',
    default_output_per_run: 10,
  },
]

const plantationDefaultRuns = plantationRecipes.reduce<Record<string, string>>((acc, recipe) => {
  acc[recipe.key] = '1'
  return acc
}, {})

const plantationDefaultOutputPerRun = plantationRecipes.reduce<Record<string, string>>((acc, recipe) => {
  acc[recipe.key] = String(Math.max(1, recipe.default_output_per_run))
  return acc
}, {})


export default function ItemsClient({ defaultView = 'catalog' }: { defaultView?: ItemsView }) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [view, setView] = useState<ItemsView>(defaultView)
  const [itemActionEntry, setItemActionEntry] = useState<{ id: string; name: string } | null>(null)
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null)
  const [calcMode, setCalcMode] = useState<DrugCalcMode>('coke')
  const [calcQuantity, setCalcQuantity] = useState(1)
  const [plantationRuns, setPlantationRuns] = useState<Record<string, string>>(plantationDefaultRuns)
  const [plantationOutputPerRun, setPlantationOutputPerRun] = useState<Record<string, string>>(plantationDefaultOutputPerRun)
  const [realizingRecipeKey, setRealizingRecipeKey] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const refreshInFlightRef = useRef(false)

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) return
    refreshInFlightRef.current = true
    try {
      setItems(await listCatalogItemsUnified())
    } finally {
      refreshInFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (view !== 'catalog') return

    const intervalId = window.setInterval(() => {
      if (document.hidden) return
      void refresh()
    }, 4000)

    const onWindowFocus = () => {
      void refresh()
    }

    const onVisibility = () => {
      if (!document.hidden) void refresh()
    }

    window.addEventListener('focus', onWindowFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onWindowFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh, view])

  const typeOptions = useMemo(() => {
    const pool = items.filter((x) => (category === 'all' ? true : x.category === category))
    const dynamicTypes = Array.from(new Set(pool.map((x) => x.item_type))).map((value) => ({ value, label: getTypeLabel(value) }))
    return [{ value: 'all', label: copy.common.allTypes }, ...dynamicTypes]
  }, [items, category])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (category !== 'all' && it.category !== category) return false
      if (type !== 'all' && it.item_type !== type) return false
      if (!q) return true
      return `${it.name} ${it.internal_id} ${it.description || ''}`.toLowerCase().includes(q)
    })
  }, [items, category, type, query])


  useEffect(() => {
    const viewParam = searchParams.get('view')
    const categoryParam = searchParams.get('category')
    if (viewParam === 'tools') setView('tools')
    if (viewParam === 'catalog') setView('catalog')
    if (categoryParam && ['objects', 'weapons', 'equipment', 'drugs', 'custom'].includes(categoryParam)) setCategory(categoryParam as CategoryFilter)
  }, [searchParams])

  const drugItems = useMemo(() => items.filter((item) => item.category === 'drugs').map((item) => ({ name: item.name, price: item.buy_price })), [items])
  const drugCalculator = useMemo(() => buildDrugCalculatorResult(calcMode, Math.max(1, Math.floor(calcQuantity || 1)), drugItems), [calcMode, calcQuantity, drugItems])


  const itemsByNormalizedName = useMemo(() => {
    const map = new Map<string, CatalogItem>()
    for (const item of items) {
      map.set(normalizeItemName(item.name), item)
    }
    return map
  }, [items])

  const findItemByName = useCallback((name: string) => {
    return itemsByNormalizedName.get(normalizeItemName(name)) || null
  }, [itemsByNormalizedName])

  const findItemForLabel = useCallback((label: string) => {
    const aliases: Record<string, string[]> = {
      "bouteille d'eau": ["bouteille d'eau", "eau"],
      "machine de meth": ["machine de meth", "meth"],
      fertilisant: ["fertilisant", "engrais"],
      pot: ["pot", "pots"],
      lampe: ["lampe", "lampes"],
      table: ["table", "tables"],
      batterie: ["batterie", "batteries"],
    }
    const normalized = normalizeItemName(label)
    const candidates = aliases[normalized] || [normalized]

    for (const candidate of candidates) {
      const exact = itemsByNormalizedName.get(candidate)
      if (exact) return exact
    }

    return null
  }, [itemsByNormalizedName])


  const calculatorTotals = useMemo(() => {
    const totalRequiredItems = drugCalculator.requirements.reduce((sum, req) => sum + Math.max(0, req.qty || 0), 0)
    const withStock = drugCalculator.requirements.reduce((sum, req) => {
      const item = findItemForLabel(req.label)
      return sum + Math.max(0, Number(item?.stock || 0))
    }, 0)
    const totalMissing = drugCalculator.requirements.reduce((sum, req) => {
      const item = findItemForLabel(req.label)
      const stock = Math.max(0, Number(item?.stock || 0))
      return sum + Math.max(0, req.qty - stock)
    }, 0)
    return { totalRequiredItems, withStock, totalMissing }
  }, [drugCalculator, findItemForLabel])

  const selectedCalculatorRecipe = useMemo(() => plantationRecipes.find((recipe) => recipe.key === (calcMode === 'coke' ? 'coke-leaf' : 'meth')) || null, [calcMode])
  const selectedCalculatorRuns = selectedCalculatorRecipe ? (plantationRuns[selectedCalculatorRecipe.key] || '1') : '1'
  const selectedCalculatorOutput = selectedCalculatorRecipe ? (plantationOutputPerRun[selectedCalculatorRecipe.key] || String(selectedCalculatorRecipe.default_output_per_run)) : '1'

  const realizePlantation = useCallback(async (recipe: PlantationRecipe) => {
    const runs = Math.max(0, Math.floor(Number(plantationRuns[recipe.key] || 0) || 0))
    const outputPerRun = Math.max(0, Math.floor(Number(plantationOutputPerRun[recipe.key] || recipe.default_output_per_run) || recipe.default_output_per_run))

    if (runs <= 0) {
      toast.error('Indique un nombre de plantations supérieur à 0.')
      return
    }

    const required = recipe.requirements.map((req) => ({ ...req, total: req.qty * runs, item: findItemByName(req.name) }))
    const missingRequired = required.filter((req) => !req.item).map((req) => req.name)
    if (missingRequired.length > 0) {
      toast.error(`Items manquants dans le catalogue: ${missingRequired.join(', ')}`)
      return
    }

    const stockMissing = required
      .filter((req) => (req.item?.stock || 0) < req.total)
      .map((req) => `${req.name} (stock ${req.item?.stock || 0}, besoin ${req.total})`)
    if (stockMissing.length > 0) {
      toast.error(`Stock insuffisant: ${stockMissing.join(' · ')}`)
      return
    }

    const outputItem = findItemByName(recipe.output_name)
    if (!outputItem) {
      toast.error(`Item de production introuvable: ${recipe.output_name}`)
      return
    }

    setRealizingRecipeKey(recipe.key)
    try {
      for (const req of required) {
        await createFinanceTransaction({
          item_id: req.item!.id,
          mode: 'sell',
          quantity: req.total,
          unit_price: 0,
          counterparty: 'Plantation',
          notes: `${recipe.title} x${runs}`,
          payment_mode: 'stock_out',
        })
      }

      await createFinanceTransaction({
        item_id: outputItem.id,
        mode: 'buy',
        quantity: outputPerRun * runs,
        unit_price: 0,
        counterparty: 'Plantation',
        notes: `${recipe.title} x${runs}`,
        payment_mode: 'other',
      })

      await refresh()
      toast.success(`Plantation réalisée: +${outputPerRun * runs} ${recipe.output_name}`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible de réaliser la plantation.')
    } finally {
      setRealizingRecipeKey(null)
    }
  }, [findItemByName, plantationOutputPerRun, plantationRuns, refresh])


  const adjustPlantationField = useCallback((
    key: string,
    field: 'runs' | 'output',
    delta: number,
    fallback: number,
  ) => {
    const source = field === 'runs' ? plantationRuns : plantationOutputPerRun
    const setter = field === 'runs' ? setPlantationRuns : setPlantationOutputPerRun
    const current = Math.max(0, Math.floor(Number(source[key] ?? fallback) || fallback))
    const next = Math.max(0, current + delta)
    setter((prev) => ({ ...prev, [key]: String(next) }))
  }, [plantationOutputPerRun, plantationRuns])

  const categoryCounts = useMemo(() => {
    const sumStock = (predicate: (category: string) => boolean) =>
      items.reduce((total, item) => {
        if (!predicate(item.category)) return total
        return total + Math.max(0, Number(item.stock) || 0)
      }, 0)

    return {
      objects: sumStock((category) => category === 'objects'),
      weapons: sumStock((category) => category === 'weapons'),
      equipment: sumStock((category) => category === 'equipment'),
      drugs: sumStock((category) => category === 'drugs'),
      other: sumStock((category) => category === 'custom'),
      all: sumStock(() => true),
    }
  }, [items])

  return (
    <Panel>
      {view === 'catalog' ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { key: 'all', label: 'Tous', value: categoryCounts.all, icon: Shapes },
              { key: 'objects', label: 'Objets', value: categoryCounts.objects, icon: Box },
              { key: 'weapons', label: 'Armes', value: categoryCounts.weapons, icon: Swords },
              { key: 'equipment', label: 'Équipement', value: categoryCounts.equipment, icon: Shield },
              { key: 'drugs', label: 'Drogues', value: categoryCounts.drugs, icon: Pill },
              { key: 'custom', label: 'Autres', value: categoryCounts.other, icon: Shapes },
            ].map((card) => {
              const Icon = card.icon
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => { setCategory(card.key as CategoryFilter); setType('all') }}
                  className={`rounded-2xl border px-3 py-3 text-left transition min-h-[108px] ${
                    category === card.key
                      ? 'border-cyan-300/55 bg-gradient-to-br from-cyan-500/28 to-blue-500/16 shadow-[0_0_0_1px_rgba(56,189,248,0.22)_inset]'
                      : card.key === 'objects'
                        ? 'border-cyan-300/20 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.13]'
                        : card.key === 'weapons'
                          ? 'border-rose-300/20 bg-rose-500/[0.06] hover:bg-rose-500/[0.13]'
                          : card.key === 'equipment'
                            ? 'border-violet-300/20 bg-violet-500/[0.06] hover:bg-violet-500/[0.13]'
                            : card.key === 'drugs'
                              ? 'border-emerald-300/20 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.13]'
                              : card.key === 'custom'
                                ? 'border-amber-300/20 bg-amber-500/[0.06] hover:bg-amber-500/[0.13]'
                                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-white/70">{card.label}</p>
                    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/80"><Icon className="h-3.5 w-3.5" /></div>
                  </div>
                  <p className="mt-5 text-2xl font-semibold leading-none">{card.value}</p>
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" className="w-[280px]" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {typeOptions.map((opt) => (
              <TabPill key={opt.value} active={type === opt.value} onClick={() => setType(opt.value as TypeFilter)}>
                {opt.label}
              </TabPill>
            ))}
            <div className="ml-auto">
              <Link href="/items/nouveau">
                <PrimaryButton>{copy.common.createItem}</PrimaryButton>
              </Link>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
            {filtered.length === 0 ? <div className="p-6 text-center text-sm text-white/60">Aucun item trouvé pour ces filtres.</div> : null}
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-white/70">
                <tr>
                  <th className="px-4 py-3 text-left">Image</th>
                  <th className="px-4 py-3 text-left">Nom</th>
                  <th className="px-4 py-3 text-left">Catégorie</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Stock</th>
                  <th className="px-4 py-3 text-left">Achat / Vente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((it) => (
                  <tr key={it.id} className="cursor-pointer hover:bg-white/[0.02]" onClick={() => setItemActionEntry({ id: it.id, name: it.name })}>
                    <td className="px-4 py-3">
                      <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                        {it.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-white/40">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold">{it.name}</td>
                    <td className="px-4 py-3">{getCategoryLabel(it.category)}</td>
                    <td className="px-4 py-3">{getTypeLabel(it.item_type, it.category)}</td>
                    <td className="px-4 py-3">{it.stock}</td>
                    <td className="px-4 py-3">{it.buy_price.toFixed(2)} / {it.sell_price.toFixed(2)} $</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="mb-3 text-sm font-semibold">Calculateur drogue (Items)</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-white/60">Mode</label>
                <GlassSelect value={calcMode} onChange={(v) => setCalcMode(v as DrugCalcMode)} options={[{ value: 'coke', label: 'Coke' }, { value: 'meth', label: 'Meth' }]} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Quantité</label>
                <input
                  value={String(calcQuantity)}
                  onChange={(e) => setCalcQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                  className="h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Total connu</label>
                <div className="flex h-10 items-center rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 text-sm">
                  <span className="font-semibold">{drugCalculator.totalKnown.toFixed(2)} $</span>
                </div>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-sm">
                <p className="text-xs text-cyan-100/80">Items requis (total)</p>
                <p className="text-xl font-semibold">{calculatorTotals.totalRequiredItems}</p>
              </div>
              <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-sm">
                <p className="text-xs text-emerald-100/80">Stock cumulé (items liés)</p>
                <p className="text-xl font-semibold">{calculatorTotals.withStock}</p>
              </div>
              <div className="rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-sm">
                <p className="text-xs text-rose-100/80">Manque estimé</p>
                <p className="text-xl font-semibold">{calculatorTotals.totalMissing}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {drugCalculator.requirements.map((req) => {
                const requirementItem = findItemForLabel(req.label)
                const stock = Math.max(0, Number(requirementItem?.stock || 0))
                const missing = Math.max(0, req.qty - stock)
                return (
                  <div key={req.label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                        {requirementItem?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={requirementItem.image_url} alt={req.label} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-white/40">
                            <ImageIcon className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                      <div className="font-medium">{req.label}</div>
                    </div>
                    <div className="mt-2 grid gap-1.5 text-xs">
                      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1"><span className="text-white/70">Besoin total</span><span className="font-semibold">{req.qty}</span></div>
                      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1"><span className="text-white/70">Stock actuel</span><span className="font-semibold">{stock}</span></div>
                      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1"><span className="text-white/70">Manque</span><span className={`font-semibold ${missing > 0 ? 'text-rose-200' : 'text-emerald-200'}`}>{missing}</span></div>
                      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1"><span className="text-white/70">PU</span><span className="font-semibold">{req.unitPrice == null ? '—' : `${req.unitPrice.toFixed(2)} $`}</span></div>
                      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1"><span className="text-white/70">Sous-total</span><span className="font-semibold">{req.subtotal == null ? '—' : `${req.subtotal.toFixed(2)} $`}</span></div>
                    </div>
                  </div>
                )
              })}
            </div>
            {selectedCalculatorRecipe ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-white/65">
                  Nb plantations
                  <div className="mt-1 flex items-center gap-1">
                    <SecondaryButton className="h-9 rounded-lg px-3" onClick={() => adjustPlantationField(selectedCalculatorRecipe.key, 'runs', -1, 0)}>-</SecondaryButton>
                    <Input
                      value={selectedCalculatorRuns}
                      onChange={(event) => setPlantationRuns((curr) => ({ ...curr, [selectedCalculatorRecipe.key]: event.target.value }))}
                      inputMode="numeric"
                      className="h-9 rounded-lg px-2 text-sm"
                    />
                    <SecondaryButton className="h-9 rounded-lg px-3" onClick={() => adjustPlantationField(selectedCalculatorRecipe.key, 'runs', 1, 0)}>+</SecondaryButton>
                  </div>
                </label>
                <label className="text-xs text-white/65">
                  Production reçue / plantation
                  <div className="mt-1 flex items-center gap-1">
                    <SecondaryButton className="h-9 rounded-lg px-3" onClick={() => adjustPlantationField(selectedCalculatorRecipe.key, 'output', -1, selectedCalculatorRecipe.default_output_per_run)}>-</SecondaryButton>
                    <Input
                      value={selectedCalculatorOutput}
                      onChange={(event) => setPlantationOutputPerRun((curr) => ({ ...curr, [selectedCalculatorRecipe.key]: event.target.value }))}
                      inputMode="numeric"
                      className="h-9 rounded-lg px-2 text-sm"
                    />
                    <SecondaryButton className="h-9 rounded-lg px-3" onClick={() => adjustPlantationField(selectedCalculatorRecipe.key, 'output', 1, selectedCalculatorRecipe.default_output_per_run)}>+</SecondaryButton>
                  </div>
                </label>
              </div>
            ) : null}
            {drugCalculator.hasMissingPrices ? <p className="mt-2 text-xs text-amber-300">Prix manquants: {drugCalculator.missingPrices.join(', ')}</p> : null}
            {selectedCalculatorRecipe ? (
              <PrimaryButton
                className="mt-3 w-full"
                disabled={realizingRecipeKey === selectedCalculatorRecipe.key}
                onClick={() => { void realizePlantation(selectedCalculatorRecipe) }}
              >
                {realizingRecipeKey === selectedCalculatorRecipe.key ? 'Validation...' : 'Plantation réalisée'}
              </PrimaryButton>
            ) : null}
          </div>

        </div>
      )}



      {itemActionEntry ? (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setItemActionEntry(null)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Panel>
              <h3 className="text-lg font-semibold">Gérer l’item</h3>
              <p className="mt-1 text-sm text-white/65">{itemActionEntry.name}</p>
              <div className="mt-4 grid gap-2">
                <SecondaryButton
                  onClick={() => {
                    router.push(`/items/modifier/${encodeURIComponent(itemActionEntry.id)}`)
                    setItemActionEntry(null)
                  }}
                >
                  Modifier
                </SecondaryButton>
                <DangerButton
                  onClick={() => {
                    const target = items.find((entry) => entry.id === itemActionEntry.id)
                    if (!target) return
                    setDeletingItem(target)
                    setItemActionEntry(null)
                  }}
                >
                  Supprimer
                </DangerButton>
                <SecondaryButton onClick={() => setItemActionEntry(null)}>{copy.common.cancel}</SecondaryButton>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      {deletingItem ? (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <Panel className="w-full max-w-lg">
            <h3 className="text-lg font-semibold">Confirmer la suppression</h3>
            <p className="mt-2 text-sm text-white/70">Supprimer l’item « {deletingItem.name} » ?</p>
            <div className="mt-4 flex justify-end gap-2">
              <SecondaryButton onClick={() => setDeletingItem(null)}>{copy.common.cancel}</SecondaryButton>
              <DangerButton
                onClick={async () => {
                  const previous = [...items]
                  setItems((rows) => rows.filter((x) => x.id !== deletingItem.id))
                  try {
                    const result = await deleteCatalogItem(deletingItem.id)
                    toast.success(result.detail || (result.mode === 'hidden' ? 'Item masqué pour ce groupe.' : 'Item supprimé.'))
                    setDeletingItem(null)
                  } catch (error: unknown) {
                    setItems(previous)
                    toast.error(error instanceof Error ? error.message : 'Suppression impossible.')
                  }
                }}
              >
                Supprimer
              </DangerButton>
            </div>
          </Panel>
        </div>
      ) : null}

    </Panel>
  )
}
