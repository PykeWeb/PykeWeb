'use client'

import { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { PrimaryButton, SearchInput } from '@/components/ui/design-system'
import { createCatalogItem, listCatalogItems } from '@/lib/itemsApi'
import type { CatalogItem, ItemCategory, ItemType } from '@/lib/types/itemsFinance'
import { ItemForm } from '@/components/ui/ItemForm'
import { copy } from '@/lib/copy'

type CategoryFilter = 'all' | ItemCategory

type TypeFilter = 'all' | ItemType

export default function ItemsClient() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [openCreate, setOpenCreate] = useState(false)

  async function refresh() {
    setItems(await listCatalogItems())
  }

  useEffect(() => {
    void refresh()
  }, [])

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
        <GlassSelect
          value={category}
          onChange={(v) => setCategory(v as CategoryFilter)}
          options={[
            { value: 'all', label: copy.common.allCategories },
            { value: 'objects', label: 'Objets' },
            { value: 'weapons', label: 'Armes' },
            { value: 'drugs', label: 'Drogues' },
            { value: 'equipment', label: 'Équipements' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
        <GlassSelect value={type} onChange={(v) => setType(v as TypeFilter)} options={typeOptions} />
        <PrimaryButton onClick={() => setOpenCreate(true)}>{copy.common.createItem}</PrimaryButton>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">Image</th>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Catégorie</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Stock</th>
              <th className="px-4 py-3 text-left">Achat / Vente</th>
              <th className="px-4 py-3 text-left">ID interne</th>
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
                <td className="px-4 py-3">{it.category}</td>
                <td className="px-4 py-3">{it.item_type}</td>
                <td className="px-4 py-3">{it.stock}</td>
                <td className="px-4 py-3">{it.buy_price.toFixed(2)} / {it.sell_price.toFixed(2)} $</td>
                <td className="px-4 py-3 text-white/70">{it.internal_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openCreate ? (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-5xl">
            <ItemForm
              onCancel={() => setOpenCreate(false)}
              onSave={async (payload) => {
                await createCatalogItem(payload)
                await refresh()
                setOpenCreate(false)
              }}
            />
          </div>
        </div>
      ) : null}
    </Panel>
  )
}
