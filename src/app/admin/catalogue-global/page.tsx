'use client'

import { useEffect, useMemo, useState } from 'react'
import { getTenantSession } from '@/lib/tenantSession'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { DangerButton, PrimaryButton, SearchInput, SecondaryButton, TabPill } from '@/components/ui/design-system'
import { categoryTypeOptions, itemCategoryOptions, normalizeCatalogCategory, normalizeItemType } from '@/lib/catalogConfig'
import type { ItemCategory } from '@/lib/types/itemsFinance'
import { withTenantSessionHeader } from '@/lib/tenantRequest'

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

const defaultTypeByCategory: Record<ItemCategory, string> = {
  objects: categoryTypeOptions.objects[0]?.value ?? 'other',
  weapons: categoryTypeOptions.weapons[0]?.value ?? 'other',
  equipment: categoryTypeOptions.equipment[0]?.value ?? 'other',
  drugs: categoryTypeOptions.drugs[0]?.value ?? 'drug',
  custom: categoryTypeOptions.custom[0]?.value ?? 'other',
}

export default function AdminCatalogueGlobalPage() {
  const [items, setItems] = useState<GlobalItem[]>([])
  const [filterCategory, setFilterCategory] = useState<'all' | ItemCategory>('all')
  const [query, setQuery] = useState('')
  const [createCategory, setCreateCategory] = useState<ItemCategory>('objects')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('0')
  const [quantity, setQuantity] = useState('0')
  const [weaponId, setWeaponId] = useState('')
  const [createItemType, setCreateItemType] = useState<string>(defaultTypeByCategory.objects)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCategory, setEditCategory] = useState<ItemCategory>('objects')
  const [editType, setEditType] = useState<string>(defaultTypeByCategory.objects)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('0')
  const [editQuantity, setEditQuantity] = useState('0')
  const [editWeaponId, setEditWeaponId] = useState('')

  async function refresh() {
    const res = await fetch('/api/admin/global-catalog', withTenantSessionHeader({ cache: 'no-store' }))
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
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/admin/global-catalog/upload-image', {
      ...withTenantSessionHeader(),
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const message = await res.text()
      throw new Error(message || 'Upload image impossible.')
    }
    const json = (await res.json()) as { publicUrl?: string }
    if (!json.publicUrl) throw new Error('URL image manquante après upload.')
    return json.publicUrl
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
        ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
        method: 'POST',
        body: JSON.stringify({
          category: createCategory,
          name: name.trim(),
          price: Math.max(0, Number(price || 0) || 0),
          default_quantity: Math.max(0, Math.floor(Number(quantity || 0) || 0)),
          weapon_id: createCategory === 'weapons' ? weaponId.trim() || null : null,
          item_type: normalizeItemType(createItemType, createCategory),
          image_url,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setName('')
      setPrice('0')
      setQuantity('0')
      setWeaponId('')
      setCreateItemType(defaultTypeByCategory.objects)
      setImageFile(null)
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur création')
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(id: string) {
    const res = await fetch(
      '/api/admin/global-catalog',
      {
        ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
        method: 'DELETE',
        body: JSON.stringify({ id }),
      }
    )
    if (!res.ok) return
    await refresh()
  }

  function startEdit(item: GlobalItem) {
    setEditingId(item.id)
    setEditCategory(item.category)
    setEditType(normalizeItemType(item.item_type, item.category))
    setEditName(item.name)
    setEditPrice(String(Math.max(0, Number(item.price || 0) || 0)))
    setEditQuantity(String(Math.max(0, Math.floor(Number(item.default_quantity || 0) || 0))))
    setEditWeaponId(item.weapon_id || '')
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
  }

  async function saveEdit() {
    if (!editingId) return
    if (!editName.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/global-catalog', {
        ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
        method: 'PUT',
        body: JSON.stringify({
          id: editingId,
          patch: {
            category: editCategory,
            item_type: normalizeItemType(editType, editCategory),
            name: editName.trim(),
            price: Math.max(0, Number(editPrice || 0) || 0),
            default_quantity: Math.max(0, Math.floor(Number(editQuantity || 0) || 0)),
            weapon_id: editCategory === 'weapons' ? editWeaponId.trim() || null : null,
          },
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setEditingId(null)
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur modification')
    } finally {
      setBusy(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (filterCategory !== 'all' && it.category !== filterCategory) return false
      if (!q) return true
      return `${it.name} ${it.item_type ?? ''} ${it.weapon_id ?? ''}`.toLowerCase().includes(q)
    })
  }, [items, query, filterCategory])

  const createTypeOptions = categoryTypeOptions[createCategory]

  return (
    <div className="space-y-4">
      <Panel>
        <h1 className="text-2xl font-semibold">Objets (catalogue global)</h1>
        <p className="mt-1 text-sm text-white/70">Catalogue partagé entre modules, avec override local par groupe.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs text-white/60">Catégorie</label>
            <div className="flex flex-wrap gap-2">
              {itemCategoryOptions.map((option) => (
                <TabPill
                  key={option.value}
                  active={createCategory === option.value}
                  onClick={() => {
                    const nextCategory = option.value as ItemCategory
                    setCreateCategory(nextCategory)
                    setCreateItemType(defaultTypeByCategory[nextCategory])
                  }}
                >
                  {option.label}
                </TabPill>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs text-white/60">Type</label>
            <div className="flex flex-wrap gap-2">
              {createTypeOptions.map((option) => (
                <TabPill key={option.value} active={createItemType === option.value} onClick={() => setCreateItemType(option.value)}>
                  {option.label}
                </TabPill>
              ))}
            </div>
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
          <div className="flex flex-wrap gap-2">
            <TabPill active={filterCategory === 'all'} onClick={() => setFilterCategory('all')}>Toutes catégories</TabPill>
            {itemCategoryOptions.map((option) => (
              <TabPill key={option.value} active={filterCategory === option.value} onClick={() => setFilterCategory(option.value as ItemCategory)}>
                {option.label}
              </TabPill>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {filtered.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">Aucun item à afficher pour ces filtres.</div> : null}
          {filtered.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <div className="flex flex-1 items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                  {it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                {editingId === it.id ? (
                  <div className="grid flex-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom" />
                    <Input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} inputMode="decimal" placeholder="Prix" />
                    <Input value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} inputMode="numeric" placeholder="Stock" />
                    <div className="md:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
                      {itemCategoryOptions.map((option) => (
                        <TabPill key={option.value} active={editCategory === option.value} onClick={() => {
                          const next = option.value as ItemCategory
                          setEditCategory(next)
                          setEditType(defaultTypeByCategory[next])
                        }}>
                          {option.label}
                        </TabPill>
                      ))}
                    </div>
                    <div className="md:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
                      {categoryTypeOptions[editCategory].map((option) => (
                        <TabPill key={option.value} active={editType === option.value} onClick={() => setEditType(option.value)}>
                          {option.label}
                        </TabPill>
                      ))}
                    </div>
                    {editCategory === 'weapons' ? (
                      <Input value={editWeaponId} onChange={(e) => setEditWeaponId(e.target.value)} placeholder="Weapon ID / hash" />
                    ) : null}
                  </div>
                ) : (
                  <p>
                    {it.name} <span className="text-white/60">{Number(it.price || 0).toFixed(2)}$ • stock {Math.max(0, Number(it.default_quantity || 0))}</span>
                  </p>
                )}
              </div>
              <div className="ml-3 flex items-center gap-2">
                {editingId === it.id ? (
                  <>
                    <PrimaryButton disabled={busy} onClick={() => void saveEdit()}>Enregistrer</PrimaryButton>
                    <SecondaryButton disabled={busy} onClick={() => cancelEdit()}>Annuler</SecondaryButton>
                  </>
                ) : (
                  <SecondaryButton onClick={() => startEdit(it)}>Modifier</SecondaryButton>
                )}
                <DangerButton onClick={() => void removeItem(it.id)}>Supprimer</DangerButton>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
