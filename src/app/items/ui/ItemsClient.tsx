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
import type { CatalogItem, ItemCategory } from '@/lib/types/itemsFinance'
import { copy } from '@/lib/copy'
import { buildDrugCalculatorResult, type DrugCalcMode } from '@/lib/drugCalculator'
import { getCategoryLabel, getTypeFilterOptions, getTypeLabel, matchesTypeFilter, type UnifiedTypeFilterValue } from '@/lib/catalogConfig'
import { markStockOutNote } from '@/lib/financeStockFlow'
import { computeItemStockCategoryStats } from '@/lib/itemStockStats'
import { useUiThemeConfig } from '@/hooks/useUiThemeConfig'

type CategoryFilter = 'all' | ItemCategory
type TypeFilter = UnifiedTypeFilterValue
type ItemsView = 'catalog' | 'tools'

const TYPE_FILTER_VALUES: TypeFilter[] = ['all', 'objects', 'equipment', 'weapon', 'ammo', 'weapon_accessory', 'seed', 'pouch', 'drug_material', 'product', 'other']

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

function formatPrice(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(2)} $`
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
    default_output_per_run: 1,
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


export default function ItemsClient({
  defaultView = 'catalog',
  initialCategory = 'all',
}: {
  defaultView?: ItemsView
  initialCategory?: CategoryFilter
}) {
  const themeConfig = useUiThemeConfig()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [catalogReady, setCatalogReady] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>(initialCategory)
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
      setCatalogReady(true)
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

  useEffect(() => {
    setCategory(initialCategory)
  }, [initialCategory])

  const typeOptions = useMemo(() => getTypeFilterOptions(category), [category])

  const availableTypeValues = useMemo(() => typeOptions.map((option) => option.value), [typeOptions])

  useEffect(() => {
    if (!availableTypeValues.includes(type)) setType('all')
  }, [availableTypeValues, type])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (category !== 'all' && it.category !== category) return false
      if (!matchesTypeFilter(it, category, type)) return false
      if (!q) return true
      return `${it.name} ${it.internal_id} ${it.description || ''}`.toLowerCase().includes(q)
    })
  }, [items, category, type, query])


  useEffect(() => {
    const viewParam = searchParams.get('view')
    const categoryParam = searchParams.get('category')
    const typeParam = searchParams.get('type')
    const queryParam = searchParams.get('q')

    setView(viewParam === 'tools' ? 'tools' : viewParam === 'catalog' ? 'catalog' : defaultView)
    setCategory(categoryParam && ['objects', 'weapons', 'equipment', 'drugs', 'custom'].includes(categoryParam) ? categoryParam as CategoryFilter : 'all')
    setType(typeParam && TYPE_FILTER_VALUES.includes(typeParam as TypeFilter) ? typeParam as TypeFilter : 'all')
    setQuery(queryParam || '')
  }, [defaultView, searchParams])

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
      eaux: ["eau", "bouteille d'eau"],
      "graine de coke": ["graine de coke", 'graine', 'graines', 'seed'],
      "machine de meth": ["machine de meth", "meth"],
      fertilisant: ["fertilisant", "engrais"],
      pot: ["pot", "pots"],
      lampe: ["lampe", "lampes"],
      table: ["table", "tables"],
      batterie: ["batterie", "batteries"],
      'meth brut': ['meth brut', 'meth'],
      ammoniaque: ['ammoniaque'],
      methylamine: ['methylamine'],
    }
    const normalized = normalizeItemName(label)
    const candidates = aliases[normalized] || [normalized]

    for (const candidate of candidates) {
      const exact = itemsByNormalizedName.get(candidate)
      if (exact) return exact
    }

    for (const candidate of candidates) {
      const contains = items.find((item) => normalizeItemName(item.name).includes(candidate) || candidate.includes(normalizeItemName(item.name)))
      if (contains) return contains
    }

    return null
  }, [items, itemsByNormalizedName])


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
  const selectedProductionFieldLabel = useMemo(() => {
    if (!selectedCalculatorRecipe) return 'Production'
    return selectedCalculatorRecipe.key === 'coke-leaf' ? 'Production totale (feuilles)' : 'Production totale (sortie)'
  }, [selectedCalculatorRecipe])

  const selectedOutputItem = useMemo(() => {
    if (!selectedCalculatorRecipe) return null
    const exact = findItemByName(selectedCalculatorRecipe.output_name)
    if (exact) return exact

    const normalizedOutput = normalizeItemName(selectedCalculatorRecipe.output_name)
    return items.find((item) => normalizeItemName(item.name).includes(normalizedOutput) || normalizedOutput.includes(normalizeItemName(item.name))) || null
  }, [findItemByName, items, selectedCalculatorRecipe])

  const missingEstimatedCost = useMemo(() => (
    drugCalculator.requirements.reduce((sum, req) => {
      if (req.unitPrice == null) return sum
      const item = findItemForLabel(req.label)
      const stock = Math.max(0, Number(item?.stock || 0))
      const missing = Math.max(0, req.qty - stock)
      return sum + (missing * req.unitPrice)
    }, 0)
  ), [drugCalculator.requirements, findItemForLabel])

  const realizePlantation = useCallback(async (recipe: PlantationRecipe) => {
    const runs = Math.max(0, Math.floor(Number(plantationRuns[recipe.key] || 0) || 0))
    const outputQuantity = Math.max(0, Math.floor(Number(plantationOutputPerRun[recipe.key] || recipe.default_output_per_run) || recipe.default_output_per_run))

    if (runs <= 0) {
      toast.error('Indique un nombre de plantations supérieur à 0.')
      return
    }

    const required = recipe.requirements.map((req) => {
      const item = findItemForLabel(req.name)
      const total = req.qty * runs
      const available = Math.max(0, Number(item?.stock || 0))
      const removable = Math.min(total, available)
      return { ...req, item, total, available, removable }
    })

    const outputItem = findItemByName(recipe.output_name)
    if (!outputItem) {
      toast.error(`Item de production introuvable: ${recipe.output_name}`)
      return
    }

    const missingCatalog = required.filter((req) => !req.item).map((req) => req.name)
    const partialStock = required
      .filter((req) => req.item && req.removable < req.total)
      .map((req) => `${req.name} (${req.removable}/${req.total})`)

    setRealizingRecipeKey(recipe.key)
    try {
      for (const req of required) {
        if (!req.item || req.removable <= 0) continue
        await createFinanceTransaction({
          item_id: req.item.id,
          mode: 'sell',
          quantity: req.removable,
          unit_price: 0,
          counterparty: 'Plantation',
          notes: markStockOutNote(`${recipe.title} x${runs}`),
          payment_mode: 'other',
        })
      }

      await createFinanceTransaction({
        item_id: outputItem.id,
        mode: 'buy',
        quantity: outputQuantity,
        unit_price: 0,
        counterparty: 'Plantation',
        notes: `${recipe.title} x${runs}`,
        payment_mode: 'other',
      })

      await refresh()
      if (missingCatalog.length > 0 || partialStock.length > 0) {
        toast.warning('Certains éléments nécessaires étaient manquants dans le stock, mais la plantation a été enregistrée.')
      }
      toast.success(`Plantation réalisée: +${outputQuantity} ${recipe.output_name}`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible de réaliser la plantation.')
    } finally {
      setRealizingRecipeKey(null)
    }
  }, [findItemByName, findItemForLabel, plantationOutputPerRun, plantationRuns, refresh])


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

  const categoryCounts = useMemo(() => computeItemStockCategoryStats(items), [items])

  return (
    <Panel className={view === 'tools' ? 'border-0 bg-transparent p-0 shadow-none' : undefined}>
      {view === 'catalog' ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { key: 'all', label: 'Tous', value: categoryCounts.all, icon: Shapes },
              { key: 'objects', label: 'Objets', value: categoryCounts.objects, icon: Box },
              { key: 'weapons', label: 'Armes', value: categoryCounts.weapons, icon: Swords },
              { key: 'equipment', label: 'Équipement', value: categoryCounts.equipment, icon: Shield },
              { key: 'drugs', label: 'Drogues', value: categoryCounts.drugs, icon: Pill },
              { key: 'custom', label: 'Autres\u200b', value: categoryCounts.other, icon: Shapes },
            ].map((card) => {
              const Icon = card.icon
              const uiKey = `items.category.${card.key}`
              const override = themeConfig.bubbles[uiKey]
              return (
                <button
                  key={card.key}
                  type="button"
                  data-bubble-key={uiKey}
                  onClick={() => { setCategory(card.key as CategoryFilter); setType('all') }}
                  style={{
                    background: override?.bgColor || undefined,
                    borderColor: override?.borderColor || undefined,
                    color: override?.textColor || undefined,
                    minWidth: override?.minWidthPx ? `${override.minWidthPx}px` : undefined,
                    minHeight: override?.minHeightPx ? `${override.minHeightPx}px` : undefined,
                  }}
                  className={`rounded-2xl border px-3 py-3 text-left transition min-h-[108px] ${
                    category === card.key
                      ? card.key === 'objects'
                        ? 'border-cyan-200/75 bg-gradient-to-br from-cyan-500/35 to-blue-500/25'
                        : card.key === 'weapons'
                          ? 'border-rose-200/75 bg-gradient-to-br from-rose-500/35 to-red-500/25'
                          : card.key === 'equipment'
                            ? 'border-amber-200/75 bg-gradient-to-br from-amber-700/35 to-orange-700/25'
                            : card.key === 'drugs'
                              ? 'border-emerald-200/75 bg-gradient-to-br from-emerald-500/35 to-teal-500/25'
                              : card.key === 'custom'
                                ? 'border-slate-200/75 bg-gradient-to-br from-slate-500/35 to-slate-700/25'
                                : 'border-slate-200/70 bg-gradient-to-br from-slate-500/30 to-slate-700/22'
                      : card.key === 'objects'
                        ? 'border-cyan-300/20 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.13]'
                        : card.key === 'weapons'
                          ? 'border-rose-300/20 bg-rose-500/[0.06] hover:bg-rose-500/[0.13]'
                          : card.key === 'equipment'
                            ? 'border-amber-300/20 bg-amber-700/[0.16] hover:bg-amber-700/[0.24]'
                            : card.key === 'drugs'
                              ? 'border-emerald-300/20 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.13]'
                              : card.key === 'custom'
                                ? 'border-slate-300/20 bg-slate-500/[0.06] hover:bg-slate-500/[0.13]'
                                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-white/70" data-mod-source={`items.category.${card.key}.label`}>{card.label}</p>
                    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/80"><Icon className="h-3.5 w-3.5" /></div>
                  </div>
                  <p className="mt-5 text-2xl font-semibold leading-none">{card.value}</p>
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" className="h-10 min-w-[240px] flex-1" />
              <Link href="/items/nouveau" className="ml-auto shrink-0">
                <PrimaryButton>{copy.common.createItem}</PrimaryButton>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {typeOptions.map((opt) => (
                <TabPill
                  key={opt.value}
                  active={type === opt.value}
                  onClick={() => setType(opt.value as TypeFilter)}
                  data-mod-source={`items.type.${category}.${opt.value}`}
                >
                  {opt.label}
                </TabPill>
              ))}
            </div>
          </div>

          <div className="mt-2 overflow-hidden rounded-2xl border border-white/10">
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
                    <td className="px-4 py-3">
                      <span data-mod-source={`items.row.${it.id}.category`}>{getCategoryLabel(it.category)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span data-mod-source={`items.row.${it.id}.type`}>{getTypeLabel(it.item_type, it.category)}</span>
                    </td>
                    <td className="px-4 py-3">{it.stock}</td>
                    <td className="px-4 py-3">{it.buy_price.toFixed(2)} / {it.sell_price.toFixed(2)} $</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block text-xs text-white/60">Mode</label>
                <GlassSelect value={calcMode} onChange={(v) => setCalcMode(v as DrugCalcMode)} options={[{ value: 'coke', label: 'Coke' }, { value: 'meth', label: 'Meth' }]} />
              </div>
              {calcMode === 'meth' ? (
                <>
                  <div className="min-w-[180px]">
                    <label className="mb-1 block text-xs text-white/60">Quantité</label>
                    <input
                      value={String(calcQuantity)}
                      onChange={(e) => setCalcQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                      className="h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm"
                      inputMode="numeric"
                    />
                  </div>
                </>
              ) : null}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
              <div className="rounded-xl border border-violet-300/25 bg-violet-500/10 px-3 py-2 text-sm">
                <p className="text-xs text-violet-100/80">Total connu</p>
                <p className="text-xl font-semibold">{drugCalculator.totalKnown.toFixed(2)} $</p>
              </div>
            </div>

            {calcMode === 'coke' ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-500/16 via-blue-500/10 to-transparent p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/15 bg-white/[0.06]">
                      {selectedOutputItem?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selectedOutputItem.image_url} alt="Session coke" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-white/60">
                          <Pill className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-cyan-50">Session coke</p>
                      <p className="text-xs text-cyan-100/85">Prépare, suis et clôture une session de plantation</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                  <p className="text-sm font-semibold">Accès rapide</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <Link href="/coke/cloturer">
                      <PrimaryButton className="w-full">Session Coke</PrimaryButton>
                    </Link>
                    <Link href="/drogues/benefice">
                      <SecondaryButton className="w-full">Bénéfice drogue</SecondaryButton>
                    </Link>
                    <Link href="/drogues/suivi-production">
                      <SecondaryButton className="w-full">Suivi production</SecondaryButton>
                    </Link>
                  </div>
                </div>
                {!catalogReady ? (
                  <p className="text-xs text-cyan-100/75">Chargement du catalogue drogue...</p>
                ) : null}
              </div>
            ) : null}

            {calcMode === 'meth' ? (
              <>
                <div className="mt-3 rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-500/14 via-indigo-500/10 to-transparent p-3 sm:p-4">
                  <p className="text-sm font-semibold text-violet-50">Session meth · calculateur classique</p>
                  <p className="mt-1 text-xs text-violet-100/80">Mode rapide : estimation + sortie/entrée stock via “Plantation réalisée”.</p>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {drugCalculator.requirements.map((req) => {
                    const requirementItem = findItemForLabel(req.label)
                    const stock = Math.max(0, Number(requirementItem?.stock || 0))
                    const missing = Math.max(0, req.qty - stock)
                    const missingCost = req.unitPrice == null ? null : missing * req.unitPrice
                    return (
                      <div key={req.label} className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.03] px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                            {requirementItem?.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={requirementItem.image_url} alt={req.label} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-white/40">
                                <ImageIcon className="h-4 w-4" />
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
                          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1"><span className="text-white/70">Coût manque</span><span className="font-semibold">{formatPrice(missingCost)}</span></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-sm">
                  <p className="text-xs text-amber-100/80">Coût estimé des ressources manquantes</p>
                  <p className="text-lg font-semibold">{formatPrice(missingEstimatedCost)}</p>
                </div>
              </>
            ) : null}

            {selectedCalculatorRecipe && calcMode === 'meth' ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="h-11 w-11 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                    {selectedOutputItem?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedOutputItem.image_url} alt={selectedOutputItem.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-white/40">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-white/60">Item produit</p>
                    <p className="truncate text-sm font-semibold text-white">{selectedOutputItem?.name || selectedCalculatorRecipe.output_name}</p>
                  </div>
                </div>

                <div className="mt-3 h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent" aria-hidden="true" />

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="min-w-0 text-xs text-white/65">
                    <p>Graines</p>
                    <div className="mt-1 flex w-full items-center gap-1">
                      <SecondaryButton type="button" className="h-9 shrink-0 rounded-lg px-3" onClick={() => adjustPlantationField(selectedCalculatorRecipe.key, 'runs', -1, 0)}>-</SecondaryButton>
                      <Input
                        value={selectedCalculatorRuns}
                        onChange={(event) => setPlantationRuns((curr) => ({ ...curr, [selectedCalculatorRecipe.key]: event.target.value }))}
                        inputMode="numeric"
                        className="h-9 min-w-0 flex-1 rounded-lg px-2 text-sm"
                      />
                      <SecondaryButton type="button" className="h-9 shrink-0 rounded-lg px-3" onClick={() => adjustPlantationField(selectedCalculatorRecipe.key, 'runs', 1, 0)}>+</SecondaryButton>
                    </div>
                  </div>
                  <div className="min-w-0 text-xs text-white/65">
                    <p>{selectedProductionFieldLabel}</p>
                    <div className="mt-1 flex w-full items-center gap-1">
                      <SecondaryButton type="button" className="h-9 shrink-0 rounded-lg px-3" onClick={() => adjustPlantationField(selectedCalculatorRecipe.key, 'output', -1, selectedCalculatorRecipe.default_output_per_run)}>-</SecondaryButton>
                      <Input
                        value={selectedCalculatorOutput}
                        onChange={(event) => setPlantationOutputPerRun((curr) => ({ ...curr, [selectedCalculatorRecipe.key]: event.target.value }))}
                        inputMode="numeric"
                        className="h-9 min-w-0 flex-1 rounded-lg px-2 text-sm"
                      />
                      <SecondaryButton type="button" className="h-9 shrink-0 rounded-lg px-3" onClick={() => adjustPlantationField(selectedCalculatorRecipe.key, 'output', 1, selectedCalculatorRecipe.default_output_per_run)}>+</SecondaryButton>
                    </div>
                  </div>
                </div>

                <PrimaryButton
                  className="mt-3 w-full"
                  disabled={realizingRecipeKey === selectedCalculatorRecipe.key}
                  onClick={() => { void realizePlantation(selectedCalculatorRecipe) }}
                >
                  {realizingRecipeKey === selectedCalculatorRecipe.key ? 'Validation...' : 'Plantation réalisée'}
                </PrimaryButton>
              </div>
            ) : null}
            {(catalogReady && drugCalculator.hasMissingPrices) ? <p className="mt-2 text-xs text-amber-300">Prix manquants: {drugCalculator.missingPrices.join(', ')}</p> : null}
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
                    const params = new URLSearchParams()
                    if (view !== 'catalog') params.set('view', view)
                    if (category !== 'all') params.set('category', category)
                    if (type !== 'all') params.set('type', type)
                    if (query.trim()) params.set('q', query.trim())
                    const suffix = params.toString()
                    router.push(`/items/modifier/${encodeURIComponent(itemActionEntry.id)}${suffix ? `?${suffix}` : ''}`)
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
