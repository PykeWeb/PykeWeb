'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Box, Calculator, Factory, Image as ImageIcon, Pill, Shield, Swords, Shapes } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/ui/Panel'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { DangerButton, PrimaryButton, SearchInput, SecondaryButton, SegmentedTabs, TabPill } from '@/components/ui/design-system'
import { createCatalogItem, createFinanceTransaction, deleteCatalogItem, listCatalogItemsUnified, updateCatalogItem } from '@/lib/itemsApi'
import type { CatalogItem, ItemCategory, ItemType } from '@/lib/types/itemsFinance'
import { ItemForm } from '@/components/ui/ItemForm'
import { copy } from '@/lib/copy'
import { FinanceItemTradeModal } from '@/components/ui/FinanceItemTradeModal'
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
  output: string
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
    output: 'Feuille de coke ×1',
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
    output: 'Meth brut (10 à 30)',
  },
]

export default function ItemsClient() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [view, setView] = useState<ItemsView>('catalog')
  const [openCreate, setOpenCreate] = useState(false)
  const [openTrade, setOpenTrade] = useState(false)
  const [itemActionEntry, setItemActionEntry] = useState<{ id: string; name: string } | null>(null)
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null)
  const [calcMode, setCalcMode] = useState<DrugCalcMode>('coke')
  const [calcQuantity, setCalcQuantity] = useState(1)
  const searchParams = useSearchParams()

  const refresh = useCallback(async () => {
    setItems(await listCatalogItemsUnified())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

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
    const action = searchParams.get('action')
    const viewParam = searchParams.get('view')
    const categoryParam = searchParams.get('category')
    if (action === 'create') setOpenCreate(true)
    if (action === 'trade') setOpenTrade(true)
    if (viewParam === 'tools') setView('tools')
    if (viewParam === 'catalog') setView('catalog')
    if (categoryParam && ['objects', 'weapons', 'equipment', 'drugs', 'custom'].includes(categoryParam)) setCategory(categoryParam as CategoryFilter)
  }, [searchParams])

  const drugItems = useMemo(() => items.filter((item) => item.category === 'drugs').map((item) => ({ name: item.name, price: item.buy_price })), [items])
  const drugCalculator = useMemo(() => buildDrugCalculatorResult(calcMode, Math.max(1, Math.floor(calcQuantity || 1)), drugItems), [calcMode, calcQuantity, drugItems])
  const categoryCounts = useMemo(() => {
    return {
      objects: items.filter((it) => it.category === 'objects').length,
      weapons: items.filter((it) => it.category === 'weapons').length,
      equipment: items.filter((it) => it.category === 'equipment').length,
      drugs: items.filter((it) => it.category === 'drugs').length,
      other: items.filter((it) => it.category === 'custom').length,
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
          <SecondaryButton onClick={() => setOpenTrade(true)}>Achat / Vente</SecondaryButton>
          <PrimaryButton onClick={() => setOpenCreate(true)}>{copy.common.createItem}</PrimaryButton>
        </div>
      </div>

      {view === 'catalog' ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { key: 'all', label: 'Tous', value: items.length, icon: Shapes },
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
                  className={`rounded-2xl border px-3 py-2.5 text-left transition ${category === card.key ? 'border-cyan-300/40 bg-cyan-500/12' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-white/70">{card.label}</p>
                    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/80"><Icon className="h-3.5 w-3.5" /></div>
                  </div>
                  <p className="mt-1 text-2xl font-semibold leading-none">{card.value}</p>
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
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-sm">
                Total connu: <span className="font-semibold">{drugCalculator.totalKnown.toFixed(2)} $</span>
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {drugCalculator.requirements.map((req) => (
                <div key={req.label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
                  <div className="font-medium">{req.label}</div>
                  <div className="text-white/70">Qté: {req.qty} · PU: {req.unitPrice == null ? '—' : `${req.unitPrice.toFixed(2)} $`}</div>
                  <div className="text-white/80">Sous-total: {req.subtotal == null ? '—' : `${req.subtotal.toFixed(2)} $`}</div>
                </div>
              ))}
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
                    {recipe.requirements.map((req) => (
                      <div key={req.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                        <span>{req.name}</span>
                        <span>× {req.qty}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/80">Output: {recipe.output}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {openCreate ? (
        <div className="mt-6">
          <ItemForm
            onCancel={() => setOpenCreate(false)}
            onSave={async (payload) => {
              try {
                await createCatalogItem(payload)
                toast.success('Item créé.')
                await refresh()
                setOpenCreate(false)
              } catch (error: unknown) {
                console.error('[items:create]', error)
                toast.error(error instanceof Error ? error.message : copy.itemForm.errors.createFailed)
              }
            }}
          />
        </div>
      ) : null}



      {itemActionEntry ? (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setItemActionEntry(null)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Panel>
              <h3 className="text-lg font-semibold">Gérer l’item</h3>
              <p className="mt-1 text-sm text-white/65">{itemActionEntry.name}</p>
              <div className="mt-4 grid gap-2">
                <SecondaryButton
                  onClick={() => {
                    const target = items.find((entry) => entry.id === itemActionEntry.id)
                    if (!target) return
                    setEditingItem(target)
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

      {editingItem ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-5xl">
            <ItemForm
              initialItem={editingItem}
              submitLabel="Enregistrer les modifications"
              onCancel={() => setEditingItem(null)}
              onSave={async (payload) => {
                try {
                  await updateCatalogItem({ ...payload, id: editingItem.id })
                  toast.success('Item modifié.')
                  await refresh()
                  setEditingItem(null)
                } catch (error: unknown) {
                  toast.error(error instanceof Error ? error.message : "Impossible de modifier l'item. Vérifie tes droits ou la politique RLS.")
                }
              }}
            />
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

      <FinanceItemTradeModal
        open={openTrade}
        mode="buy"
        enableModeSelect
        onClose={() => setOpenTrade(false)}
        onSubmit={async (payload) => {
          await createFinanceTransaction({
            item_id: payload.item.id,
            mode: payload.mode,
            quantity: payload.quantity,
            unit_price: payload.unitPrice,
            counterparty: payload.counterparty,
            notes: payload.notes,
          })
          toast.success(copy.finance.toastSaved)
          await refresh()
        }}
      />
    </Panel>
  )
}
