'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { makeUniqueInternalId, type CreateCatalogItemInput } from '@/lib/itemsApi'
import type { ItemCategory, ItemRarity, ItemType } from '@/lib/types/itemsFinance'
import { toNonNegative, toPositiveInt } from '@/lib/numberUtils'
import { copy } from '@/lib/copy'
import { getSuggestedInternalId } from '@/lib/itemId'
import { itemCategoryOptions, itemRarityOptions, itemTypeOptions } from '@/lib/catalogConfig'

export function ItemForm({ onCancel, onSave }: { onCancel: () => void; onSave: (payload: CreateCatalogItemInput) => Promise<void> }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ItemCategory>('objects')
  const [itemType, setItemType] = useState<ItemType>('input')
  const [internalId, setInternalId] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [buyPrice, setBuyPrice] = useState('0')
  const [sellPrice, setSellPrice] = useState('0')
  const [showInFinance, setShowInFinance] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [stock, setStock] = useState('0')

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [internalValue, setInternalValue] = useState('0')
  const [lowStockThreshold, setLowStockThreshold] = useState('0')
  const [stackable, setStackable] = useState(true)
  const [maxStack, setMaxStack] = useState('100')
  const [weight, setWeight] = useState('')
  const [fivemItemId, setFivemItemId] = useState('')
  const [hash, setHash] = useState('')
  const [rarity, setRarity] = useState<ItemRarity>(null)

  const [errors, setErrors] = useState<{ name?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const suggestedInternalId = useMemo(() => getSuggestedInternalId(name), [name])
  const canSave = useMemo(() => name.trim().length > 0 && itemType !== undefined && !saving, [name, itemType, saving])

  async function handleSubmit() {
    if (!name.trim()) {
      setErrors({ name: copy.itemForm.errors.nameRequired })
      return
    }

    try {
      setSaving(true)
      setErrors({})
      setFormError(null)
      const uniqueInternalId = await makeUniqueInternalId(name, internalId)
      await onSave({
        name: name.trim(),
        category,
        item_type: itemType,
        internal_id: uniqueInternalId,
        description: description.trim() || null,
        imageFile,
        buy_price: toNonNegative(buyPrice),
        sell_price: toNonNegative(sellPrice),
        internal_value: toNonNegative(internalValue),
        show_in_finance: showInFinance,
        is_active: isActive,
        stock: toNonNegative(Math.floor(Number(stock || 0))),
        low_stock_threshold: toNonNegative(Math.floor(Number(lowStockThreshold || 0))),
        stackable,
        max_stack: toPositiveInt(maxStack),
        weight: weight ? toNonNegative(weight) : null,
        fivem_item_id: fivemItemId.trim() || null,
        hash: hash.trim() || null,
        rarity,
      })
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : copy.itemForm.errors.createFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <h3 className="text-lg font-semibold">Création d&apos;item</h3>
        <p className="mt-1 text-sm text-white/65">Mode simple : les champs essentiels sont visibles. Les options techniques sont rangées dans la section avancée.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.name}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l’item" />
            {errors.name ? <p className="mt-1 text-xs text-rose-300">{errors.name}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.category}</label>
            <GlassSelect value={category} onChange={(v) => setCategory(v as ItemCategory)} options={itemCategoryOptions} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.type}</label>
            <GlassSelect value={itemType} onChange={(v) => setItemType(v as ItemType)} options={itemTypeOptions} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.description}</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[42px]" />
          </div>
          <ImageDropzone label="Image (upload / preview / glisser-déposer / coller)" onChange={setImageFile} />
          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.buyPrice}</label>
            <Input value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.sellPrice}</label>
            <Input value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.stockInitial}</label>
            <Input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" />
          </div>
          <div className="flex items-end gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />{copy.itemForm.toggles.active}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showInFinance} onChange={(e) => setShowInFinance(e.target.checked)} />{copy.itemForm.toggles.showInFinance}</label>
          </div>
        </div>
      </Panel>

      <Panel>
        <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="flex w-full items-center justify-between text-left">
          <div>
            <h3 className="text-lg font-semibold">Options avancées</h3>
            <p className="text-sm text-white/60">IDs, paramètres de stack/poids et champs RP/FiveM.</p>
          </div>
          <ChevronDown className={`h-5 w-5 text-white/70 transition ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {showAdvanced ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.internalId}</label>
              <Input value={internalId} onChange={(e) => setInternalId(e.target.value)} placeholder={suggestedInternalId} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.internalValue}</label>
              <Input value={internalValue} onChange={(e) => setInternalValue(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.stockLow}</label>
              <Input value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.weight}</label>
              <Input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.maxStack}</label>
              <Input value={maxStack} onChange={(e) => setMaxStack(e.target.value)} inputMode="numeric" disabled={!stackable} />
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={stackable} onChange={(e) => setStackable(e.target.checked)} />{copy.itemForm.toggles.stackable}</label>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.fivemItemId}</label>
              <Input value={fivemItemId} onChange={(e) => setFivemItemId(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.hash}</label>
              <Input value={hash} onChange={(e) => setHash(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">{copy.itemForm.fields.rarity}</label>
              <GlassSelect value={rarity || ''} onChange={(v) => setRarity((v || null) as ItemRarity)} options={itemRarityOptions} />
            </div>
          </div>
        ) : null}
      </Panel>

      {formError ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{formError}</div> : null}
      <div className="flex justify-end gap-2">
        <SecondaryButton onClick={onCancel}>{copy.common.cancel}</SecondaryButton>
        <PrimaryButton onClick={handleSubmit} disabled={!canSave}>{saving ? 'Enregistrement…' : copy.common.save}</PrimaryButton>
      </div>
    </div>
  )
}
