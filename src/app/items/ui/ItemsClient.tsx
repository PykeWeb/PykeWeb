'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calculator, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/ui/Panel'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { DangerButton, PrimaryButton, SearchInput, SecondaryButton } from '@/components/ui/design-system'
import { createCatalogItem, createFinanceTransaction, deleteCatalogItem, listCatalogItemsUnified, updateCatalogItem } from '@/lib/itemsApi'
import type { CatalogItem, ItemCategory, ItemType } from '@/lib/types/itemsFinance'
import { ItemForm } from '@/components/ui/ItemForm'
import { copy } from '@/lib/copy'
import { FinanceItemTradeModal } from '@/components/ui/FinanceItemTradeModal'
import { buildDrugCalculatorResult, type DrugCalcMode } from '@/lib/drugCalculator'
import { getCategoryLabel, getTypeLabel, itemCategoryOptions } from '@/lib/catalogConfig'

type CategoryFilter = 'all' | ItemCategory
type TypeFilter = 'all' | ItemType

export default function ItemsClient() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [openCreate, setOpenCreate] = useState(false)
  const [openTrade, setOpenTrade] = useState(false)
  const [openManager, setOpenManager] = useState(false)
  const [managerQuery, setManagerQuery] = useState('')
  const [managerCategory, setManagerCategory] = useState<CategoryFilter>('all')
  const [managerType, setManagerType] = useState<TypeFilter>('all')
  const [managerSelectedId, setManagerSelectedId] = useState('')
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null)
  const [calcMode, setCalcMode] = useState<DrugCalcMode>('coke')
  const [calcQuantity, setCalcQuantity] = useState(1)
  const [showCalculator, setShowCalculator] = useState(false)

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

  const managerTypeOptions = useMemo(() => {
    const pool = items.filter((x) => (managerCategory === 'all' ? true : x.category === managerCategory))
    const dynamicTypes = Array.from(new Set(pool.map((x) => x.item_type))).map((value) => ({ value, label: getTypeLabel(value) }))
    return [{ value: 'all', label: copy.common.allTypes }, ...dynamicTypes]
  }, [items, managerCategory])

  const managerFiltered = useMemo(() => {
    const q = managerQuery.trim().toLowerCase()
    return items.filter((it) => {
      if (managerCategory !== 'all' && it.category !== managerCategory) return false
      if (managerType !== 'all' && it.item_type !== managerType) return false
      if (!q) return true
      return `${it.name} ${it.internal_id} ${it.description || ''}`.toLowerCase().includes(q)
    })
  }, [items, managerCategory, managerType, managerQuery])

  useEffect(() => {
    if (!openManager) return
    if (!managerFiltered.find((x) => x.id === managerSelectedId)) {
      setManagerSelectedId(managerFiltered[0]?.id || '')
    }
  }, [openManager, managerFiltered, managerSelectedId])

  const selectedManagerItem = useMemo(() => managerFiltered.find((x) => x.id === managerSelectedId) || null, [managerFiltered, managerSelectedId])

  const drugItems = useMemo(() => items.filter((item) => item.category === 'drugs').map((item) => ({ name: item.name, price: item.buy_price })), [items])
  const drugCalculator = useMemo(() => buildDrugCalculatorResult(calcMode, calcQuantity, drugItems), [calcMode, calcQuantity, drugItems])

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" className="w-[200px]" />
        <GlassSelect value={category} onChange={(v) => setCategory(v as CategoryFilter)} options={[{ value: 'all', label: copy.common.allCategories }, ...itemCategoryOptions]} />
        <GlassSelect value={type} onChange={(v) => setType(v as TypeFilter)} options={typeOptions} />
        <SecondaryButton onClick={() => setOpenManager(true)}>Gérer items</SecondaryButton>
        <SecondaryButton onClick={() => setOpenTrade(true)}>Achat / Vente</SecondaryButton>
        <SecondaryButton onClick={() => setShowCalculator((prev) => !prev)}>{showCalculator ? "Masquer calculateur" : "Ouvrir calculateur"}</SecondaryButton>
        <PrimaryButton onClick={() => setOpenCreate(true)}>{copy.common.createItem}</PrimaryButton>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCategory('all')}
          className={`rounded-xl border px-3 py-1.5 text-sm transition ${category === 'all' ? 'border-cyan-300/40 bg-cyan-500/15 text-cyan-100' : 'border-white/15 bg-white/5 text-white/75 hover:bg-white/10'}`}
        >
          Tous
        </button>
        {itemCategoryOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setCategory(opt.value as CategoryFilter)}
            className={`rounded-xl border px-3 py-1.5 text-sm transition ${category === opt.value ? 'border-cyan-300/40 bg-cyan-500/15 text-cyan-100' : 'border-white/15 bg-white/5 text-white/75 hover:bg-white/10'}`}
          >
            {opt.label}
          </button>
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
              <tr key={it.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                    {it.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-white/40"><ImageIcon className="h-4 w-4" /></div>
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

      {showCalculator ? (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
      ) : null}

      {openCreate ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-5xl">
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
        </div>
      ) : null}

      {openManager ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setOpenManager(false)}>
          <div className="mx-auto w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Panel>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">Gestion des items</h3>
                <SecondaryButton onClick={() => setOpenManager(false)}>Fermer</SecondaryButton>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <SearchInput value={managerQuery} onChange={(e) => setManagerQuery(e.target.value)} placeholder="Chercher un item" />
                <GlassSelect value={managerCategory} onChange={(v) => setManagerCategory(v as CategoryFilter)} options={[{ value: 'all', label: copy.common.allCategories }, ...itemCategoryOptions]} />
                <GlassSelect value={managerType} onChange={(v) => setManagerType(v as TypeFilter)} options={managerTypeOptions} />
                <GlassSelect value={managerSelectedId} onChange={setManagerSelectedId} options={managerFiltered.map((it) => ({ value: it.id, label: `${it.name} · ${getCategoryLabel(it.category)}` }))} />
              </div>
              {selectedManagerItem ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-sm text-white/70">Sélection: <span className="font-semibold text-white">{selectedManagerItem.name}</span></div>
                  <div className="mt-3 flex justify-end gap-2">
                    <SecondaryButton onClick={() => { setEditingItem(selectedManagerItem); setOpenManager(false) }}>Modifier</SecondaryButton>
                    <DangerButton onClick={() => { setDeletingItem(selectedManagerItem); setOpenManager(false) }}>Supprimer</DangerButton>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-white/60">Aucun item correspondant.</div>
              )}
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
