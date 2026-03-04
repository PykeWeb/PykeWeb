'use client'

import { useEffect, useMemo, useState } from 'react'
import { getTenantSession } from '@/lib/tenantSession'
import { supabase } from '@/lib/supabase/client'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { DangerButton, PrimaryButton, SearchInput } from '@/components/ui/design-system'
import { itemCategoryOptions, normalizeCatalogCategory } from '@/lib/catalogConfig'
import type { ItemCategory } from '@/lib/types/itemsFinance'

type GlobalItem = {
  id: string
  category: ItemCategory
  item_type: string | null
  name: string
  price: number
  default_quantity: number
  image_url: string | null
  weapon_id: string | null
}

const drugTypeOptions = [
  { value: 'drug', label: 'Produit' },
  { value: 'seed', label: 'Graine' },
  { value: 'planting', label: 'Plantation' },
  { value: 'pouch', label: 'Pochon' },
  { value: 'other', label: 'Autre' },
]

export default function AdminCatalogueGlobalPage() {
  const [items, setItems] = useState<GlobalItem[]>([])
  const [filterCategory, setFilterCategory] = useState<'all' | ItemCategory>('all')
  const [query, setQuery] = useState('')
  const [createCategory, setCreateCategory] = useState<ItemCategory>('objects')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('0')
  const [quantity, setQuantity] = useState('0')
  const [weaponId, setWeaponId] = useState('')
  const [drugType, setDrugType] = useState('drug')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const res = await fetch('/api/admin/global-catalog', { cache: 'no-store' })
    const data = await res.json()
    const normalized = (Array.isArray(data) ? data : [])
      .map((row) => ({ ...row, category: normalizeCatalogCategory(String(row.category)) }))
      .filter((row): row is GlobalItem => Boolean(row.category))
    setItems(normalized)
  }

  useEffect(() => {
    const session = getTenantSession()
    if (!session?.isAdmin) {
      window.location.href = '/'
      return
    }
    void refresh()
  }, [])

  async function uploadImage(file: File) {
    const ext = file.type.includes('png') ? 'png' : 'jpg'
    const path = `global/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('global-item-images').upload(path, file, { upsert: true, contentType: file.type || undefined })
    if (uploadErr) throw uploadErr
    const { data } = supabase.storage.from('global-item-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function addItem() {
    if (!name.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    try {
      setBusy(true)
      setError(null)
      const image_url = imageFile ? await uploadImage(imageFile) : null
      const res = await fetch('/api/admin/global-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: createCategory,
          name: name.trim(),
          price: Math.max(0, Number(price || 0) || 0),
          default_quantity: Math.max(0, Math.floor(Number(quantity || 0) || 0)),
          weapon_id: createCategory === 'weapons' ? weaponId.trim() || null : null,
          item_type: createCategory === 'drugs' ? drugType : null,
          image_url,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setName('')
      setPrice('0')
      setQuantity('0')
      setWeaponId('')
      setImageFile(null)
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur création')
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(id: string) {
    const res = await fetch('/api/admin/global-catalog', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!res.ok) return
    await refresh()
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (filterCategory !== 'all' && it.category !== filterCategory) return false
      if (!q) return true
      return `${it.name} ${it.item_type ?? ''} ${it.weapon_id ?? ''}`.toLowerCase().includes(q)
    })
  }, [items, query, filterCategory])

  return (
    <div className="space-y-4">
      <Panel>
        <h1 className="text-2xl font-semibold">Objets (catalogue global)</h1>
        <p className="mt-1 text-sm text-white/70">Catalogue partagé entre modules, avec override local par groupe.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">Catégorie</label>
            <GlassSelect value={createCategory} onChange={(v) => setCreateCategory(v as ItemCategory)} options={itemCategoryOptions} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Nom</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'item" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Prix ($)</label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Stock par défaut</label>
            <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" />
          </div>
          {createCategory === 'weapons' ? (
            <div>
              <label className="mb-1 block text-xs text-white/60">Weapon ID / hash</label>
              <Input value={weaponId} onChange={(e) => setWeaponId(e.target.value)} placeholder="weapon_pistol" />
            </div>
          ) : null}
          {createCategory === 'drugs' ? (
            <div>
              <label className="mb-1 block text-xs text-white/60">Type drogue</label>
              <GlassSelect value={drugType} onChange={setDrugType} options={drugTypeOptions} />
            </div>
          ) : null}
          <ImageDropzone label="Image (upload / coller / glisser)" onChange={setImageFile} />
        </div>

        <div className="mt-4 flex justify-end">
          <PrimaryButton disabled={busy} onClick={() => void addItem()}>{busy ? 'Ajout…' : 'Ajouter au catalogue'}</PrimaryButton>
        </div>
        {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un item" className="w-[320px]" />
          <GlassSelect
            value={filterCategory}
            onChange={(v) => setFilterCategory(v as 'all' | ItemCategory)}
            options={[{ value: 'all', label: 'Toutes catégories' }, ...itemCategoryOptions]}
          />
        </div>

        <div className="mt-4 space-y-2">
          {filtered.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">Aucun item à afficher pour ces filtres.</div> : null}
          {filtered.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                  {it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <p>
                  {it.name} <span className="text-white/60">{Number(it.price || 0).toFixed(2)}$ • stock {Math.max(0, Number(it.default_quantity || 0))}</span>
                </p>
              </div>
              <DangerButton onClick={() => void removeItem(it.id)}>Supprimer</DangerButton>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
