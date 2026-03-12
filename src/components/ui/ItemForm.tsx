'use client'

import { useMemo, useState } from 'react'
import { Box, Pill, Shapes, Shield, Swords } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { PrimaryButton, SecondaryButton, TabPill } from '@/components/ui/design-system'
import { CenteredFormLayout } from '@/components/ui/CenteredFormLayout'
import { makeUniqueInternalId, type CreateCatalogItemInput } from '@/lib/itemsApi'
import type { CatalogItem, ItemCategory, ItemType } from '@/lib/types/itemsFinance'
import { toNonNegative } from '@/lib/numberUtils'
import { copy } from '@/lib/copy'
import { categoryTypeOptions, normalizeItemType } from '@/lib/catalogConfig'

export function ItemForm({
  onCancel,
  onSave,
  initialItem,
  submitLabel,
  actionsPlacement,
  panelClassName,
  hideTitle = false,
}: {
  onCancel: () => void
  onSave: (payload: CreateCatalogItemInput) => Promise<void>
  initialItem?: CatalogItem
  submitLabel?: string
  actionsPlacement?: 'top-right' | 'bottom-right'
  panelClassName?: string
  hideTitle?: boolean
}) {
  const [name, setName] = useState(initialItem?.name ?? '')
  const [category, setCategory] = useState<ItemCategory>(initialItem?.category ?? 'objects')
  const [itemType, setItemType] = useState<ItemType>(normalizeItemType(initialItem?.item_type ?? null, initialItem?.category ?? 'objects'))
  const [weaponId, setWeaponId] = useState(initialItem?.fivem_item_id ?? '')
  const [description, setDescription] = useState(initialItem?.description ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [buyPrice, setBuyPrice] = useState(String(initialItem?.buy_price ?? 0))
  const [sellPrice, setSellPrice] = useState(String(initialItem?.sell_price ?? 0))
  const [stock, setStock] = useState(String(initialItem?.stock ?? 0))

  const [errors, setErrors] = useState<{ name?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const typeOptions = useMemo(() => categoryTypeOptions[category], [category])
  const canSave = useMemo(() => name.trim().length > 0 && !saving, [name, saving])
  const safeBuyPrice = toNonNegative(buyPrice)
  const safeSellPrice = toNonNegative(sellPrice)
  const safeStock = toNonNegative(Math.floor(Number(stock || 0)))

  async function handleSubmit() {
    if (!name.trim()) {
      setErrors({ name: copy.itemForm.errors.nameRequired })
      return
    }

    try {
      setSaving(true)
      setErrors({})
      setFormError(null)
      const uniqueInternalId = await makeUniqueInternalId(name, initialItem?.internal_id)

      await onSave({
        name: name.trim(),
        category,
        item_type: normalizeItemType(itemType, category),
        internal_id: uniqueInternalId,
        description: description.trim() || null,
        imageFile,
        buy_price: safeBuyPrice,
        sell_price: safeSellPrice,
        internal_value: initialItem?.internal_value ?? 0,
        show_in_finance: initialItem?.show_in_finance ?? true,
        is_active: initialItem?.is_active ?? true,
        stock: safeStock,
        low_stock_threshold: initialItem?.low_stock_threshold ?? 0,
        stackable: initialItem?.stackable ?? true,
        max_stack: initialItem?.max_stack ?? 100,
        weight: initialItem?.weight ?? null,
        fivem_item_id: category === 'weapons' ? weaponId.trim() || null : null,
      })
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : copy.itemForm.errors.createFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <CenteredFormLayout
      title={hideTitle ? undefined : (initialItem ? 'Modifier l’item (Items)' : 'Nouvel item (Items)')}
      actions={
        <>
          <SecondaryButton onClick={onCancel}>{copy.common.cancel}</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={!canSave}>{saving ? 'Enregistrement…' : submitLabel || copy.common.save}</PrimaryButton>
        </>
      }
      actionsPlacement={actionsPlacement || 'top-right'}
      panelClassName={panelClassName}
    >
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.labels.name}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Coke" />
            {errors.name ? <p className="mt-1 text-xs text-rose-300">{errors.name}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.labels.description}</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="h-10 min-h-0" />
          </div>

          <div className="md:col-span-2">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[
                { key: 'objects' as const, label: 'Objets', icon: Box },
                { key: 'weapons' as const, label: 'Armes', icon: Swords },
                { key: 'equipment' as const, label: 'Équipement', icon: Shield },
                { key: 'drugs' as const, label: 'Drogues', icon: Pill },
                { key: 'custom' as const, label: 'Autres\u200b', icon: Shapes },
              ].map((card) => {
                const Icon = card.icon
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => {
                      const nextCategory = card.key as ItemCategory
                      setCategory(nextCategory)
                      setItemType(categoryTypeOptions[nextCategory][0].value)
                    }}
                    className={`rounded-2xl border px-3 py-3 text-left transition min-h-[88px] ${
                      category === card.key
                        ? card.key === 'objects'
                          ? 'border-cyan-200/75 bg-gradient-to-br from-cyan-500/35 to-blue-500/25'
                          : card.key === 'weapons'
                            ? 'border-rose-200/75 bg-gradient-to-br from-rose-500/35 to-red-500/25'
                            : card.key === 'equipment'
                              ? 'border-amber-200/75 bg-gradient-to-br from-amber-700/35 to-orange-700/25'
                              : card.key === 'drugs'
                                ? 'border-emerald-200/75 bg-gradient-to-br from-emerald-500/35 to-teal-500/25'
                                : 'border-slate-200/75 bg-gradient-to-br from-slate-500/35 to-slate-700/25'
                        : card.key === 'objects'
                          ? 'border-cyan-300/20 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.13]'
                          : card.key === 'weapons'
                            ? 'border-rose-300/20 bg-rose-500/[0.06] hover:bg-rose-500/[0.13]'
                            : card.key === 'equipment'
                              ? 'border-amber-300/20 bg-amber-700/[0.16] hover:bg-amber-700/[0.24]'
                              : card.key === 'drugs'
                                ? 'border-emerald-300/20 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.13]'
                                : 'border-slate-300/20 bg-slate-500/[0.06] hover:bg-slate-500/[0.13]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-white/70">{card.label}</p>
                      <div className="rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/80"><Icon className="h-3.5 w-3.5" /></div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs text-white/60">{copy.itemForm.labels.type}</label>
            <div className="flex flex-wrap gap-2">
              {typeOptions.map((option) => (
                <TabPill key={option.value} active={itemType === option.value} onClick={() => setItemType(option.value as ItemType)}>
                  {option.label}
                </TabPill>
              ))}
            </div>
          </div>

          {category === 'weapons' ? (
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.itemForm.labels.weaponId}</label>
              <Input value={weaponId} onChange={(e) => setWeaponId(e.target.value)} placeholder="weapon_pistol" />
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/60">{copy.itemForm.labels.image}</label>
          {initialItem?.image_url ? (
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2">
              <div className="h-12 w-12 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={initialItem.image_url} alt={initialItem.name} className="h-full w-full object-cover" />
              </div>
              <p className="text-xs text-white/70">Image actuelle</p>
            </div>
          ) : null}
          <ImageDropzone label="Ajoute une image (PNG/JPEG)" onChange={setImageFile} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.labels.buyPrice}</label>
            <Input value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.labels.sellPrice}</label>
            <Input value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.labels.initialStock}</label>
            <Input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" />
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Résumé item</span>
            <span className="font-semibold">Achat: {safeBuyPrice.toFixed(2)} $ · Vente: {safeSellPrice.toFixed(2)} $ · Stock: {safeStock}</span>
          </div>
        </div>
      </div>

      {formError ? <div className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{formError}</div> : null}
    </CenteredFormLayout>
  )
}
