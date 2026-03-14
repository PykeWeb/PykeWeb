'use client'

import { useEffect, useMemo, useState } from 'react'
import { Box, Pill, Shapes, Shield, Swords, type LucideIcon } from 'lucide-react'
import { getTenantSession } from '@/lib/tenantSession'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { DangerButton, PrimaryButton, SearchInput, SecondaryButton, TabPill } from '@/components/ui/design-system'
import { categoryTypeOptions, getTypeFilterOptions, itemCategoryOptions, normalizeCatalogCategory, normalizeItemType, type UnifiedTypeFilterValue } from '@/lib/catalogConfig'
import type { ItemCategory } from '@/lib/types/itemsFinance'
import { withTenantSessionHeader } from '@/lib/tenantRequest'
import { useUiThemeConfig } from '@/hooks/useUiThemeConfig'
import { PageHeader } from '@/components/PageHeader'

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
  drugs: categoryTypeOptions.drugs[0]?.value ?? 'drug_material',
  custom: categoryTypeOptions.custom[0]?.value ?? 'other',
}

const categoryIconByKey: Record<ItemCategory, LucideIcon> = {
  objects: Box,
  weapons: Swords,
  equipment: Shield,
  drugs: Pill,
  custom: Shapes,
}

const ADMIN_VISIBLE_CATEGORIES: ItemCategory[] = ['objects', 'weapons', 'equipment', 'drugs', 'custom']
const ADMIN_CATEGORY_ORDER: ItemCategory[] = ['objects', 'weapons', 'equipment', 'drugs', 'custom']

const categoryLabelByKey = Object.fromEntries(itemCategoryOptions.map((option) => [option.value, option.label])) as Record<ItemCategory, string>

const ADMIN_CATEGORY_CARDS: { key: ItemCategory; label: string; icon: LucideIcon }[] = ADMIN_CATEGORY_ORDER.map((key) => ({
  key,
  label: key === 'custom' ? 'Autres' : (categoryLabelByKey[key] ?? 'Autres'),
  icon: categoryIconByKey[key],
}))

function getAdminTypeFilterOptions(category: 'all' | ItemCategory): { value: UnifiedTypeFilterValue; label: string }[] {
  const base = getTypeFilterOptions(category)
  if (category !== 'all') return base

  const byValue = new Map(base.map((option) => [option.value, option]))
  const preferredOrder: UnifiedTypeFilterValue[] = ['all', 'objects', 'weapon', 'equipment', 'ammo', 'weapon_accessory', 'seed', 'pouch', 'drug_material', 'product', 'other']

  return preferredOrder
    .map((value) => byValue.get(value))
    .filter((option): option is { value: UnifiedTypeFilterValue; label: string } => Boolean(option))
}

function matchesAdminTypeFilter(item: GlobalItem, selectedCategory: 'all' | ItemCategory, selectedType: UnifiedTypeFilterValue): boolean {
  if (selectedType === 'all') return true
  if (selectedCategory === 'all') {
    if (selectedType === 'objects') return item.category === 'objects'
    if (selectedType === 'equipment') return item.category === 'equipment'
    if (selectedType === 'other') return item.category === 'custom'
  }
  return normalizeItemType(item.item_type, item.category) === selectedType
}

function getCategoryCardClass(category: 'all' | ItemCategory, active: boolean): string {
  if (category === 'all') return active ? 'border-slate-200/70 bg-gradient-to-br from-slate-500/30 to-slate-700/22' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'
  if (category === 'objects') return active ? 'border-cyan-200/75 bg-gradient-to-br from-cyan-500/35 to-blue-500/25' : 'border-cyan-300/20 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.13]'
  if (category === 'weapons') return active ? 'border-rose-200/75 bg-gradient-to-br from-rose-500/35 to-red-500/25' : 'border-rose-300/20 bg-rose-500/[0.06] hover:bg-rose-500/[0.13]'
  if (category === 'equipment') return active ? 'border-amber-200/75 bg-gradient-to-br from-amber-700/35 to-orange-700/25' : 'border-amber-300/20 bg-amber-700/[0.16] hover:bg-amber-700/[0.24]'
  if (category === 'drugs') return active ? 'border-emerald-200/75 bg-gradient-to-br from-emerald-500/35 to-teal-500/25' : 'border-emerald-300/20 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.13]'
  return active ? 'border-slate-200/75 bg-gradient-to-br from-slate-500/35 to-slate-700/25' : 'border-slate-300/20 bg-slate-500/[0.06] hover:bg-slate-500/[0.13]'
}

export default function AdminCatalogueGlobalPage() {
  const themeConfig = useUiThemeConfig()
  const [items, setItems] = useState<GlobalItem[]>([])
  const [filterCategory, setFilterCategory] = useState<'all' | ItemCategory>('all')
  const [filterType, setFilterType] = useState<UnifiedTypeFilterValue>('all')
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
      .filter((row) => ADMIN_VISIBLE_CATEGORIES.includes(row.category))
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
    const res = await fetch('/api/admin/global-catalog', {
      ...withTenantSessionHeader({ headers: { 'Content-Type': 'application/json' } }),
      method: 'DELETE',
      body: JSON.stringify({ id }),
    })
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
      if (!matchesAdminTypeFilter(it, filterCategory, filterType)) return false
      if (!q) return true
      return `${it.name} ${it.item_type ?? ''} ${it.weapon_id ?? ''}`.toLowerCase().includes(q)
    })
  }, [items, query, filterCategory, filterType])

  const createTypeOptions = categoryTypeOptions[createCategory]
  const typeFilterOptions = getAdminTypeFilterOptions(filterCategory)

  const categoryCounts = useMemo(() => {
    const counts: Record<ItemCategory, number> = {
      objects: 0,
      weapons: 0,
      equipment: 0,
      drugs: 0,
      custom: 0,
    }
    for (const item of items) {
      counts[item.category] += 1
    }
    return {
      ...counts,
      all: items.length,
    }
  }, [items])

  return (
    <div className="space-y-4">
      <Panel>
        <PageHeader
          title="Items (catalogue global)"
          subtitle="Catalogue partagé entre modules, avec override local par groupe."
        />

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs text-white/60">Catégorie</label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {ADMIN_CATEGORY_CARDS.map((card) => {
                const Icon = card.icon
                const uiKey = `items.category.${card.key}`
                const bubble = themeConfig.bubbles[uiKey]
                return (
                  <button
                    key={card.key}
                    type="button"
                    data-bubble-key={uiKey}
                    onClick={() => {
                      setCreateCategory(card.key)
                      setCreateItemType(defaultTypeByCategory[card.key])
                    }}
                    style={{
                      background: bubble?.bgColor || undefined,
                      borderColor: bubble?.borderColor || undefined,
                      color: bubble?.textColor || undefined,
                      minWidth: bubble?.minWidthPx ? `${bubble.minWidthPx}px` : undefined,
                      minHeight: bubble?.minHeightPx ? `${bubble.minHeightPx}px` : undefined,
                    }}
                    className={`rounded-2xl border px-3 py-3 text-left transition min-h-[88px] ${getCategoryCardClass(card.key, createCategory === card.key)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-white/70" data-mod-source={card.label}>{card.label}</p>
                      <div className="rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/80"><Icon className="h-3.5 w-3.5" /></div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs text-white/60">Type</label>
            <div className="flex flex-wrap gap-2">
              {createTypeOptions.map((option) => (
                <TabPill key={option.value} active={createItemType === option.value} onClick={() => setCreateItemType(option.value)} data-mod-source={option.label}>
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
          <div className="text-xs text-white/55">Filtrer par catégorie</div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            { key: 'all' as const, label: 'Tous', value: categoryCounts.all, icon: Shapes },
            ...ADMIN_CATEGORY_CARDS.map((card) => ({ key: card.key, label: card.label, value: categoryCounts[card.key], icon: card.icon })),
          ].map((card) => {
            const Icon = card.icon
            const active = filterCategory === card.key || (card.key === 'all' && filterCategory === 'all')
            const uiKey = `items.category.${card.key}`
            const bubble = themeConfig.bubbles[uiKey]
            return (
              <button
                key={card.key}
                type="button"
                data-bubble-key={uiKey}
                onClick={() => {
                  setFilterCategory(card.key === 'all' ? 'all' : card.key)
                  setFilterType('all')
                }}
                style={{
                  background: bubble?.bgColor || undefined,
                  borderColor: bubble?.borderColor || undefined,
                  color: bubble?.textColor || undefined,
                  minWidth: bubble?.minWidthPx ? `${bubble.minWidthPx}px` : undefined,
                  minHeight: bubble?.minHeightPx ? `${bubble.minHeightPx}px` : undefined,
                }}
                className={`rounded-2xl border px-3 py-3 text-left transition min-h-[108px] ${getCategoryCardClass(card.key, active)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-white/70" data-mod-source={card.label}>{card.label}</p>
                  <div className="rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/80"><Icon className="h-3.5 w-3.5" /></div>
                </div>
                <p className="mt-5 text-2xl font-semibold leading-none">{card.value}</p>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {typeFilterOptions.map((opt) => (
            <TabPill key={opt.value} active={filterType === opt.value} onClick={() => setFilterType(opt.value)} data-mod-source={opt.label}>
              {opt.label}
            </TabPill>
          ))}
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
                  <div className="grid flex-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-2 lg:grid-cols-3">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom" />
                    <Input value={editPrice} onChange={(e) => setEditPrice(e.target.value)} inputMode="decimal" placeholder="Prix" />
                    <Input value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} inputMode="numeric" placeholder="Stock" />

                    <div className="md:col-span-2 lg:col-span-3">
                      <p className="mb-2 text-xs text-white/60">Catégorie</p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {ADMIN_CATEGORY_CARDS.map((card) => {
                          const Icon = card.icon
                          const active = editCategory === card.key
                          const uiKey = `items.category.${card.key}`
                          const bubble = themeConfig.bubbles[uiKey]
                          return (
                            <button
                              key={card.key}
                              type="button"
                              data-bubble-key={uiKey}
                              onClick={() => {
                                setEditCategory(card.key)
                                setEditType(defaultTypeByCategory[card.key])
                              }}
                              style={{
                                background: bubble?.bgColor || undefined,
                                borderColor: bubble?.borderColor || undefined,
                                color: bubble?.textColor || undefined,
                                minWidth: bubble?.minWidthPx ? `${bubble.minWidthPx}px` : undefined,
                                minHeight: bubble?.minHeightPx ? `${bubble.minHeightPx}px` : undefined,
                              }}
                              className={`rounded-2xl border px-3 py-3 text-left transition ${getCategoryCardClass(card.key, active)}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs text-white/80" data-mod-source={card.label}>{card.label}</p>
                                <div className="rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/80"><Icon className="h-3.5 w-3.5" /></div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="md:col-span-2 lg:col-span-3">
                      <p className="mb-2 text-xs text-white/60">Type</p>
                      <div className="flex flex-wrap gap-2">
                        {categoryTypeOptions[editCategory].map((option) => (
                          <TabPill key={option.value} active={editType === option.value} onClick={() => setEditType(option.value)} data-mod-source={option.label}>
                            {option.label}
                          </TabPill>
                        ))}
                      </div>
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
