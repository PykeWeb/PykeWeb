'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Panel } from '@/components/ui/Panel'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { DangerButton, PrimaryButton, SearchInput, SecondaryButton } from '@/components/ui/design-system'
import { createCatalogItem, createFinanceTransaction, deleteCatalogItem, listCatalogItemsUnified, updateCatalogItem } from '@/lib/itemsApi'
import type { CatalogItem, ItemCategory, ItemType } from '@/lib/types/itemsFinance'
import { ItemForm } from '@/components/ui/ItemForm'
import { copy } from '@/lib/copy'
import { FinanceItemTradeModal } from '@/components/ui/FinanceItemTradeModal'
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
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null)

  const refresh = useCallback(async () => {
    setItems(await listCatalogItemsUnified())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const typeOptions = useMemo(() => {
    const pool = items.filter((x) => (category === 'all' ? true : x.category === category))
    const dynamicTypes = Array.from(new Set(pool.map((x) => x.item_type))).map((value) => ({ value, label: value }))
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

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" className="w-[320px]" />
        <GlassSelect value={category} onChange={(v) => setCategory(v as CategoryFilter)} options={[{ value: 'all', label: copy.common.allCategories }, ...itemCategoryOptions]} />
        <GlassSelect value={type} onChange={(v) => setType(v as TypeFilter)} options={typeOptions} />
        <SecondaryButton onClick={() => setOpenTrade(true)}>Achat / Vente</SecondaryButton>
        <PrimaryButton onClick={() => setOpenCreate(true)}>{copy.common.createItem}</PrimaryButton>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
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
              <th className="px-4 py-3 text-left">Actions</th>
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
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <SecondaryButton onClick={() => setEditingItem(it)} icon={<Pencil className="h-4 w-4" />}>Modifier</SecondaryButton>
                    <DangerButton onClick={() => setDeletingItem(it)} icon={<Trash2 className="h-4 w-4" />}>Supprimer</DangerButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                    toast.success(result.mode === 'deleted' ? 'Item supprimé.' : 'Item supprimé.')
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
            payment_mode: payload.payment_mode,
          })
          toast.success(copy.finance.toastSaved)
          await refresh()
        }}
      />
    </Panel>
  )
}
