'use client'

import { useEffect, useMemo, useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { PrimaryButton, SearchInput, SecondaryButton } from '@/components/ui/design-system'
import { createCatalogItem, listGlobalCatalogItems, type CatalogCategory, type GlobalCatalogItem } from '@/lib/catalogApi'

export default function ItemsClient() {
  const [items, setItems] = useState<GlobalCatalogItem[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | CatalogCategory>('all')
  const [type, setType] = useState('all')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('0')
  const [createCategory, setCreateCategory] = useState<CatalogCategory>('objects')
  const [createType, setCreateType] = useState('other')
  const [weaponId, setWeaponId] = useState('')

  async function refresh() {
    setItems(await listGlobalCatalogItems())
  }

  useEffect(() => {
    void refresh()
  }, [])

  const filtered = useMemo(() => items.filter((it) => {
    if (category !== 'all' && it.category !== category) return false
    if (type !== 'all' && (it.item_type || 'other') !== type) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return `${it.name} ${it.item_type || ''}`.toLowerCase().includes(q)
  }), [items, category, type, query])

  return <Panel>
    <div className="flex flex-wrap items-center justify-center gap-3">
      <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Recherche item" className="w-[320px]" />
      <GlassSelect value={category} onChange={(v) => setCategory(v as any)} options={[{ value: 'all', label: 'Toutes catégories' }, { value: 'objects', label: 'Objets' }, { value: 'weapons', label: 'Armes' }, { value: 'equipment', label: 'Équipement' }, { value: 'drugs', label: 'Drogues' }]} />
      <GlassSelect value={type} onChange={setType} options={[{ value: 'all', label: 'Tous types' }, ...Array.from(new Set(items.map((x) => x.item_type || 'other'))).map((value) => ({ value, label: value }))]} />
      <PrimaryButton onClick={() => setOpen(true)}>Créer un item</PrimaryButton>
    </div>

    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.03] text-white/70"><tr><th className="px-4 py-3 text-left">Catégorie</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Nom</th><th className="px-4 py-3 text-left">Prix</th><th className="px-4 py-3 text-left">Stock</th></tr></thead>
        <tbody className="divide-y divide-white/10">{filtered.map((it) => <tr key={it.id}><td className="px-4 py-3">{it.category}</td><td className="px-4 py-3">{it.item_type || '—'}</td><td className="px-4 py-3 font-semibold">{it.name}</td><td className="px-4 py-3">{it.price.toFixed(2)} $</td><td className="px-4 py-3">{it.stock}</td></tr>)}</tbody>
      </table>
    </div>

    {open ? <div className="fixed inset-0 z-[110] grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-white/15 bg-slate-950/90 p-5">
        <h3 className="text-xl font-semibold">Créer un item</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div><p className="text-xs text-white/60">Catégorie</p><GlassSelect className="mt-1" value={createCategory} onChange={(v) => setCreateCategory(v as CatalogCategory)} options={[{ value: 'objects', label: 'Objets' }, { value: 'weapons', label: 'Armes' }, { value: 'equipment', label: 'Équipement' }, { value: 'drugs', label: 'Drogues' }]} /></div>
          <div><p className="text-xs text-white/60">Nom</p><input className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><p className="text-xs text-white/60">Prix</p><input className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div><p className="text-xs text-white/60">Type (optionnel)</p><input className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" value={createType} onChange={(e) => setCreateType(e.target.value)} /></div>
          {createCategory === 'weapons' ? <div><p className="text-xs text-white/60">ID / code</p><input className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3" value={weaponId} onChange={(e) => setWeaponId(e.target.value)} /></div> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <SecondaryButton onClick={() => setOpen(false)}>Annuler</SecondaryButton>
          <PrimaryButton onClick={async () => { await createCatalogItem({ category: createCategory, name: name.trim(), price: Number(price || 0), item_type: createType || null, weapon_id: weaponId || null }); setOpen(false); setName(''); await refresh() }}>Créer</PrimaryButton>
        </div>
      </div>
    </div> : null}
  </Panel>
}
