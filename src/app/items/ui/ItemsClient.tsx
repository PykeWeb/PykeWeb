'use client'

import { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { PrimaryButton, SearchInput, SecondaryButton } from '@/components/ui/design-system'
import { createCatalogItem, listGlobalCatalogItems, type CatalogCategory, type GlobalCatalogItem } from '@/lib/catalogApi'

type CategoryFilter = 'all' | CatalogCategory

const categoryOptions = [
  { value: 'all', label: 'Toutes catégories' },
  { value: 'objects', label: 'Objets' },
  { value: 'weapons', label: 'Armes' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'drugs', label: 'Drogues' },
]

const drugTypeLabels: Record<string, string> = {
  drug: 'Produit',
  seed: 'Graine',
  planting: 'Plantation',
  pouch: 'Pochon / vente',
}

function categoryLabel(category: CatalogCategory) {
  if (category === 'objects') return 'Objets'
  if (category === 'weapons') return 'Armes'
  if (category === 'equipment') return 'Équipement'
  return 'Drogues'
}

function itemTypeLabel(item: GlobalCatalogItem) {
  if (item.category === 'weapons') return item.weapon_id ? `ID ${item.weapon_id}` : '—'
  if (item.category !== 'drugs') return '—'
  return item.item_type ? drugTypeLabels[item.item_type] || item.item_type : 'Produit'
}

export default function ItemsClient() {
  const [items, setItems] = useState<GlobalCatalogItem[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [type, setType] = useState('all')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('0')
  const [createCategory, setCreateCategory] = useState<CatalogCategory>('objects')
  const [createType, setCreateType] = useState('drug')
  const [weaponId, setWeaponId] = useState('')

  async function refresh() {
    setItems(await listGlobalCatalogItems())
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    setType('all')
  }, [category])

  const availableTypeOptions = useMemo(() => {
    if (category !== 'drugs') return [{ value: 'all', label: 'Tous les types' }]
    const values = Array.from(new Set(items.filter((it) => it.category === 'drugs').map((it) => it.item_type || 'drug')))
    return [{ value: 'all', label: 'Tous les types' }, ...values.map((value) => ({ value, label: drugTypeLabels[value] || value }))]
  }, [items, category])

  const filtered = useMemo(
    () =>
      items.filter((it) => {
        if (category !== 'all' && it.category !== category) return false
        if (category === 'drugs' && type !== 'all' && (it.item_type || 'drug') !== type) return false
        const q = query.trim().toLowerCase()
        if (!q) return true
        return `${it.name} ${it.weapon_id || ''} ${itemTypeLabel(it)}`.toLowerCase().includes(q)
      }),
    [items, category, type, query]
  )

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un item" className="w-[320px]" />
        <GlassSelect value={category} onChange={(v) => setCategory(v as CategoryFilter)} options={categoryOptions} />
        <GlassSelect value={type} onChange={setType} options={availableTypeOptions} />
        <PrimaryButton onClick={() => setOpen(true)}>Créer un item</PrimaryButton>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">Image</th>
              <th className="px-4 py-3 text-left">Catégorie</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left">Prix</th>
              <th className="px-4 py-3 text-left">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filtered.map((it) => (
              <tr key={it.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                    {it.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image_url} alt={it.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-white/35">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{categoryLabel(it.category)}</td>
                <td className="px-4 py-3">{itemTypeLabel(it)}</td>
                <td className="px-4 py-3 font-semibold">{it.name}</td>
                <td className="px-4 py-3">{it.price.toFixed(2)} $</td>
                <td className="px-4 py-3">{it.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/15 bg-slate-950/90 p-5">
            <h3 className="text-xl font-semibold">Créer un item</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-white/60">Catégorie</p>
                <GlassSelect
                  className="mt-1"
                  value={createCategory}
                  onChange={(v) => setCreateCategory(v as CatalogCategory)}
                  options={categoryOptions.filter((x) => x.value !== 'all') as { value: CatalogCategory; label: string }[]}
                />
              </div>
              <div>
                <p className="text-xs text-white/60">Nom</p>
                <input className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <p className="text-xs text-white/60">Prix</p>
                <input className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              {createCategory === 'drugs' ? (
                <div>
                  <p className="text-xs text-white/60">Type</p>
                  <GlassSelect
                    className="mt-1"
                    value={createType}
                    onChange={setCreateType}
                    options={[
                      { value: 'drug', label: 'Produit' },
                      { value: 'seed', label: 'Graine' },
                      { value: 'planting', label: 'Plantation' },
                      { value: 'pouch', label: 'Pochon / vente' },
                    ]}
                  />
                </div>
              ) : null}
              {createCategory === 'weapons' ? (
                <div>
                  <p className="text-xs text-white/60">ID / code</p>
                  <input className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" value={weaponId} onChange={(e) => setWeaponId(e.target.value)} />
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <SecondaryButton onClick={() => setOpen(false)}>Annuler</SecondaryButton>
              <PrimaryButton
                onClick={async () => {
                  await createCatalogItem({ category: createCategory, name: name.trim(), price: Number(price || 0), item_type: createCategory === 'drugs' ? createType : null, weapon_id: weaponId || null })
                  setOpen(false)
                  setName('')
                  await refresh()
                }}
              >
                Créer
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  )
}
