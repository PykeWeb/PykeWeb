'use client'

import { useMemo, useState } from 'react'
import { Panel } from '@/components/ui/Panel'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import type { CatalogItem, ItemCategory, ItemRarity, ItemType } from '@/lib/types/itemsFinance'
import { makeUniqueInternalId } from '@/lib/itemsApi'

const categoryOptions: { value: ItemCategory; label: string }[] = [
  { value: 'objects', label: 'Objets' },
  { value: 'weapons', label: 'Armes' },
  { value: 'drugs', label: 'Drogues' },
  { value: 'equipment', label: 'Équipements' },
  { value: 'custom', label: 'Custom' },
]

const typeOptions: { value: ItemType; label: string }[] = [
  { value: 'input', label: 'Input' },
  { value: 'output', label: 'Output' },
  { value: 'consumable', label: 'Consommable' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'production', label: 'Production' },
  { value: 'other', label: 'Autre' },
]

const rarityOptions: { value: string; label: string }[] = [
  { value: '', label: 'Aucune' },
  { value: 'common', label: 'Commun' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Épique' },
  { value: 'legendary', label: 'Légendaire' },
]

export function ItemForm({ onCancel, onSave }: { onCancel: () => void; onSave: (payload: any) => Promise<void> }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ItemCategory>('objects')
  const [itemType, setItemType] = useState<ItemType>('input')
  const [internalId, setInternalId] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [buyPrice, setBuyPrice] = useState('0')
  const [sellPrice, setSellPrice] = useState('0')
  const [internalValue, setInternalValue] = useState('0')
  const [showInFinance, setShowInFinance] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [stock, setStock] = useState('0')
  const [lowStockThreshold, setLowStockThreshold] = useState('0')
  const [stackable, setStackable] = useState(true)
  const [maxStack, setMaxStack] = useState('100')
  const [weight, setWeight] = useState('')
  const [fivemItemId, setFivemItemId] = useState('')
  const [hash, setHash] = useState('')
  const [rarity, setRarity] = useState<ItemRarity>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const canSave = useMemo(() => name.trim().length > 0 && itemType && !saving, [name, itemType, saving])

  async function handleSubmit() {
    if (!canSave) return
    try {
      setSaving(true)
      setError(null)
      const uniqueInternalId = await makeUniqueInternalId(name, internalId)
      await onSave({
        name: name.trim(),
        category,
        item_type: itemType,
        internal_id: uniqueInternalId,
        description: description.trim() || null,
        imageFile,
        buy_price: Math.max(0, Number(buyPrice || 0)),
        sell_price: Math.max(0, Number(sellPrice || 0)),
        internal_value: Math.max(0, Number(internalValue || 0)),
        show_in_finance: showInFinance,
        is_active: isActive,
        stock: Math.max(0, Math.floor(Number(stock || 0))),
        low_stock_threshold: Math.max(0, Math.floor(Number(lowStockThreshold || 0))),
        stackable,
        max_stack: Math.max(1, Math.floor(Number(maxStack || 1))),
        weight: weight ? Math.max(0, Number(weight)) : null,
        fivem_item_id: fivemItemId.trim() || null,
        hash: hash.trim() || null,
        rarity,
      })
    } catch (e: any) {
      setError(e?.message || 'Impossible de créer l’item.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <h3 className="text-lg font-semibold">Infos</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">Nom *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l’item" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Catégorie *</label>
            <GlassSelect value={category} onChange={(v) => setCategory(v as ItemCategory)} options={categoryOptions} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Type *</label>
            <GlassSelect value={itemType} onChange={(v) => setItemType(v as ItemType)} options={typeOptions} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">ID interne (unique)</label>
            <Input value={internalId} onChange={(e) => setInternalId(e.target.value)} placeholder="auto-généré depuis le nom" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-white/60">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[90px]" />
          </div>
          <ImageDropzone label="Image (upload / coller / glisser)" onChange={setImageFile} />
        </div>
      </Panel>

      <Panel>
        <h3 className="text-lg font-semibold">Économie</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div><label className="mb-1 block text-xs text-white/60">Prix achat</label><Input value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} inputMode="decimal" /></div>
          <div><label className="mb-1 block text-xs text-white/60">Prix vente</label><Input value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} inputMode="decimal" /></div>
          <div><label className="mb-1 block text-xs text-white/60">Valeur interne</label><Input value={internalValue} onChange={(e) => setInternalValue(e.target.value)} inputMode="decimal" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showInFinance} onChange={(e) => setShowInFinance(e.target.checked)} />Afficher dans Finance</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />Actif</label>
        </div>
      </Panel>

      <Panel>
        <h3 className="text-lg font-semibold">Stock</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div><label className="mb-1 block text-xs text-white/60">Stock initial</label><Input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" /></div>
          <div><label className="mb-1 block text-xs text-white/60">Seuil stock bas</label><Input value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} inputMode="numeric" /></div>
          <div><label className="mb-1 block text-xs text-white/60">Poids</label><Input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stackable} onChange={(e) => setStackable(e.target.checked)} />Empilable</label>
          <div><label className="mb-1 block text-xs text-white/60">Max stack</label><Input value={maxStack} onChange={(e) => setMaxStack(e.target.value)} inputMode="numeric" disabled={!stackable} /></div>
        </div>
      </Panel>

      <Panel>
        <h3 className="text-lg font-semibold">Avancé (RP / FiveM)</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div><label className="mb-1 block text-xs text-white/60">fivem_item_id</label><Input value={fivemItemId} onChange={(e) => setFivemItemId(e.target.value)} /></div>
          <div><label className="mb-1 block text-xs text-white/60">hash</label><Input value={hash} onChange={(e) => setHash(e.target.value)} /></div>
          <div><label className="mb-1 block text-xs text-white/60">Rareté</label><GlassSelect value={rarity || ''} onChange={(v) => setRarity((v || null) as ItemRarity)} options={rarityOptions} /></div>
        </div>
      </Panel>

      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      <div className="flex justify-end gap-2">
        <SecondaryButton onClick={onCancel}>Annuler</SecondaryButton>
        <PrimaryButton onClick={handleSubmit} disabled={!canSave}>{saving ? 'Enregistrement…' : 'Enregistrer'}</PrimaryButton>
      </div>
    </div>
  )
}
