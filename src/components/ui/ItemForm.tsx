'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { CenteredFormLayout } from '@/components/ui/CenteredFormLayout'
import { makeUniqueInternalId, type CreateCatalogItemInput } from '@/lib/itemsApi'
import type { CatalogItem, ItemCategory, ItemType } from '@/lib/types/itemsFinance'
import { toNonNegative } from '@/lib/numberUtils'
import { copy } from '@/lib/copy'
import { categoryTypeOptions, itemCategoryOptions, normalizeItemType } from '@/lib/catalogConfig'

export function ItemForm({
  onCancel,
  onSave,
  initialItem,
  submitLabel,
  actionsPlacement,
}: {
  onCancel: () => void
  onSave: (payload: CreateCatalogItemInput) => Promise<void>
  initialItem?: CatalogItem
  submitLabel?: string
  actionsPlacement?: 'top-right' | 'bottom-right'
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
      title={initialItem ? 'Modifier l’item (Items)' : 'Nouvel item (Items)'}
      subtitle={copy.itemForm.labels.unifiedSubtitle}
      actions={
        <>
          <SecondaryButton onClick={onCancel}>{copy.common.cancel}</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={!canSave}>{saving ? 'Enregistrement…' : submitLabel || copy.common.save}</PrimaryButton>
        </>
      }
      actionsPlacement={actionsPlacement || (initialItem ? 'bottom-right' : 'top-right')}
    >
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.labels.name}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Coke" />
            {errors.name ? <p className="mt-1 text-xs text-rose-300">{errors.name}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.labels.category}</label>
            <GlassSelect
              value={category}
              onChange={(v) => {
                const nextCategory = v as ItemCategory
                setCategory(nextCategory)
                setItemType(categoryTypeOptions[nextCategory][0].value)
              }}
              options={itemCategoryOptions}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.labels.type}</label>
            <GlassSelect value={itemType} onChange={(v) => setItemType(v as ItemType)} options={typeOptions} />
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

        <div>
          <label className="mb-1 block text-xs text-white/60">{copy.itemForm.labels.description}</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[120px]" />
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
