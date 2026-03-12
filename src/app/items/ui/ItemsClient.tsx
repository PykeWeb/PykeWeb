'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Box, Calculator, Factory, Image as ImageIcon, Pill, Shield, Swords, Shapes } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { DangerButton, PrimaryButton, SearchInput, SecondaryButton, SegmentedTabs, TabPill } from '@/components/ui/design-system'
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
    subtitle: '1 pot + 1 graine + 1 engrais + 3 eau = 1 feuille',
    requirements: [
      { name: 'Pot', qty: 1 },
      { name: 'Graine de coke', qty: 1 },
      { name: 'Engrais', qty: 1 },
      { name: 'Eau', qty: 3 },
    ],
    output_name: 'Feuille de coke',
    default_output_per_run: 1,
  },
  {
    key: 'meth',
    title: 'Cook meth (1 batch)',
    subtitle: 'Table + meth + batteries + chimie = 10 à 30 meth brut',
    requirements: [
      { name: 'Table', qty: 1 },
      { name: 'Meth', qty: 1 },
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


export default function ItemsClient() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [view, setView] = useState<ItemsView>('catalog')
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
    const normalized = normalizeItemName(label)
    const singular = normalized.endsWith('s') ? normalized.slice(0, -1) : normalized
    for (const item of items) {
      const itemName = normalizeItemName(item.name)
      if (
        itemName === normalized
        || itemName === singular
        || normalized.includes(itemName)
        || singular.includes(itemName)
        || itemName.includes(normalized)
        || itemName.includes(singular)
      ) {
        return item
      }
    }
    return null
  }, [items])

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          options={[
            { value: 'catalog', label: 'Catalogue' },
            { value: 'tools', label: 'Calculateur & plantations' },
          ]}
          value={view}
          onChange={setView}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/items/achat-vente">
            <SecondaryButton>Achat / Vente</SecondaryButton>
          </Link>
          <Link href="/items/nouveau">
            <PrimaryButton>{copy.common.createItem}</PrimaryButton>
          </Link>
        </div>
      </div>

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
                  className={`rounded-2xl border px-3 py-3 text-left transition min-h-[108px] ${category === card.key ? 'border-cyan-300/40 bg-cyan-500/12' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'}`}
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
            <div className="mb-3 flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              <h3 className="text-sm font-semibold">Calculateur drogue (Items)</h3>
            </div>
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
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {drugCalculator.requirements.map((req) => {
                const requirementItem = findItemForLabel(req.label)
                return (
                  <div key={req.label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
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
                    <div className="text-white/70">Qté: {req.qty} · PU : {req.unitPrice == null ? '—' : `${req.unitPrice.toFixed(2)} $`}</div>
                    <div className="text-white/80">Sous-total: {req.subtotal == null ? '—' : `${req.subtotal.toFixed(2)} $`}</div>
                  </div>
                )
              })}
            </div>
            {drugCalculator.hasMissingPrices ? <p className="mt-2 text-xs text-amber-300">Prix manquants: {drugCalculator.missingPrices.join(', ')}</p> : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Factory className="h-4 w-4" />
              <h3 className="text-sm font-semibold">Contenu plantations</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {plantationRecipes.map((recipe) => (
                <div key={recipe.key} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-sm font-semibold">{recipe.title}</p>
                  <p className="mt-1 text-xs text-white/65">{recipe.subtitle}</p>
                  <div className="mt-3 space-y-2 text-xs text-white/75">
                    {recipe.requirements.map((req) => {
                      const requirementItem = findItemByName(req.name)
                      return (
                        <div key={req.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
                              {requirementItem?.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={requirementItem.image_url} alt={req.name} className="h-full w-full object-cover" loading="lazy" />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-white/40">
                                  <ImageIcon className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                            <span>{req.name}</span>
                          </div>
                          <span>× {req.qty}</span>
                        </div>
                      )
                    })}
                  </div>
                  {(() => {
                    const outputItem = findItemByName(recipe.output_name)
                    return (
                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/80">
                        <div className="h-7 w-7 overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
                          {outputItem?.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={outputItem.image_url} alt={recipe.output_name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-white/40">
                              <ImageIcon className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                        <p>Production : {recipe.output_name}</p>
                      </div>
                    )
                  })()}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs text-white/65">
                      Nb plantations
                      <div className="mt-1 flex items-center gap-1">
                        <SecondaryButton className="h-9 rounded-lg px-3" onClick={() => adjustPlantationField(recipe.key, 'runs', -1, 0)}>-</SecondaryButton>
                        <Input
                          value={plantationRuns[recipe.key] || '0'}
                          onChange={(event) => setPlantationRuns((curr) => ({ ...curr, [recipe.key]: event.target.value }))}
                          inputMode="numeric"
                          className="h-9 rounded-lg px-2 text-sm"
                        />
                        <SecondaryButton className="h-9 rounded-lg px-3" onClick={() => adjustPlantationField(recipe.key, 'runs', 1, 0)}>+</SecondaryButton>
                      </div>
                    </label>
                    <label className="text-xs text-white/65">
                      Production reçue / plantation
                      <div className="mt-1 flex items-center gap-1">
                        <SecondaryButton className="h-9 rounded-lg px-3" onClick={() => adjustPlantationField(recipe.key, 'output', -1, recipe.default_output_per_run)}>-</SecondaryButton>
                        <Input
                          value={plantationOutputPerRun[recipe.key] || String(recipe.default_output_per_run)}
                          onChange={(event) => setPlantationOutputPerRun((curr) => ({ ...curr, [recipe.key]: event.target.value }))}
                          inputMode="numeric"
                          className="h-9 rounded-lg px-2 text-sm"
                        />
                        <SecondaryButton className="h-9 rounded-lg px-3" onClick={() => adjustPlantationField(recipe.key, 'output', 1, recipe.default_output_per_run)}>+</SecondaryButton>
                      </div>
                    </label>
                  </div>
                  <PrimaryButton
                    className="mt-3 w-full"
                    disabled={realizingRecipeKey === recipe.key}
                    onClick={() => { void realizePlantation(recipe) }}
                  >
                    {realizingRecipeKey === recipe.key ? 'Validation...' : 'Plantation réalisée'}
                  </PrimaryButton>
                </div>
              ))}
            </div>
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
