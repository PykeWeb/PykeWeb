'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CenteredFormLayout } from '@/components/ui/CenteredFormLayout'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { createExpense, type ExpenseItemType } from '@/lib/expensesApi'
import { listObjects, type DbObject } from '@/lib/objectsApi'
import { listWeapons, type DbWeapon } from '@/lib/weaponsApi'
import { listEquipment, type DbEquipment } from '@/lib/equipmentApi'
import { listDrugItems, type DbDrugItem } from '@/lib/drugsApi'

type PickItem =
  | { type: 'objects'; id: string; name: string; price: number; image_url?: string | null }
  | { type: 'weapons'; id: string; name: string; price: number; image_url?: string | null }
  | { type: 'equipment'; id: string; name: string; price: number; image_url?: string | null }
  | { type: 'drugs'; id: string; name: string; price: number; image_url?: string | null }

export function NouvelleDepenseForm({ backHref = '/depenses', successHref = '/depenses', title = 'Nouvelle dépense' }: { backHref?: string; successHref?: string; title?: string }) {
  const router = useRouter()

  const [memberName, setMemberName] = useState('')
  const [itemType, setItemType] = useState<ExpenseItemType>('objects')
  const [items, setItems] = useState<PickItem[]>([])
  const [pickedId, setPickedId] = useState<string>('')
  const [customName, setCustomName] = useState('')
  const [unitPrice, setUnitPrice] = useState<string>('0')
  const [quantity, setQuantity] = useState(1)
  const [description, setDescription] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = useMemo(() => Number(unitPrice || 0) * Number(quantity || 0), [unitPrice, quantity])
  const pickedItem = useMemo(() => items.find((x) => x.id === pickedId) || null, [items, pickedId])

  const canSave = useMemo(() => {
    if (!memberName.trim()) return false
    if (itemType === 'custom') return customName.trim().length > 0 && Number(unitPrice) >= 0 && quantity > 0 && !saving
    return pickedId.length > 0 && Number(unitPrice) >= 0 && quantity > 0 && !saving
  }, [memberName, itemType, customName, unitPrice, quantity, pickedId, saving])

  useEffect(() => {
    async function load() {
      setError(null)
      try {
        if (itemType === 'custom') {
          setItems([])
          setPickedId('')
          return
        }

        if (itemType === 'objects') {
          const data = await listObjects()
          setItems(data.map((o: DbObject) => ({ type: 'objects', id: o.id, name: o.name, price: o.price, image_url: o.image_url })))
        } else if (itemType === 'weapons') {
          const data = await listWeapons()
          setItems(data.map((w: DbWeapon) => ({ type: 'weapons', id: w.id, name: w.name || w.weapon_id || 'Arme', price: 0, image_url: w.image_url })))
        } else if (itemType === 'equipment') {
          const data = await listEquipment()
          setItems(data.map((e: DbEquipment) => ({ type: 'equipment', id: e.id, name: e.name, price: e.price, image_url: e.image_url })))
        } else if (itemType === 'drugs') {
          const data = await listDrugItems()
          setItems(data.map((d: DbDrugItem) => ({ type: 'drugs', id: d.id, name: d.name, price: d.price, image_url: d.image_url })))
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erreur')
      }
    }
    void load()
  }, [itemType])

  useEffect(() => {
    if (itemType === 'custom' || !pickedId) return
    const it = items.find((x) => x.id === pickedId)
    if (it) setUnitPrice(String(it.price ?? 0))
  }, [pickedId, items, itemType])

  return (
    <CenteredFormLayout
      title={title}
      subtitle="Formulaire unifié"
      actions={
        <>
          <Link href={backHref}><SecondaryButton>Retour</SecondaryButton></Link>
          <PrimaryButton
            disabled={!canSave}
            onClick={async () => {
              setSaving(true)
              setError(null)
              try {
                const item = itemType === 'custom' ? null : items.find((x) => x.id === pickedId) || null
                await createExpense({
                  member_name: memberName.trim(),
                  item_source: itemType,
                  item_id: item ? item.id : null,
                  item_label: itemType === 'custom' ? customName.trim() : item?.name || 'Item',
                  unit_price: Number(unitPrice),
                  default_unit_price: item ? Number(item.price ?? 0) : null,
                  quantity,
                  description: description.trim() || undefined,
                  proofFile,
                })
                router.push(successHref)
                router.refresh()
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Erreur')
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </PrimaryButton>
        </>
      }
      actionsPlacement="bottom-right"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-white/60">Nom du membre</label>
          <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Ex: Pyke" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/60">Type d&apos;item</label>
          <GlassSelect
            value={itemType}
            onChange={(v) => setItemType(v as ExpenseItemType)}
            options={[
              { value: 'objects', label: 'Objets' },
              { value: 'weapons', label: 'Armes' },
              { value: 'equipment', label: 'Équipement' },
              { value: 'drugs', label: 'Drogues' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
        </div>

        {itemType === 'custom' ? (
          <div>
            <label className="mb-1 block text-xs text-white/60">Nom custom</label>
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Nom de la dépense" />
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs text-white/60">Item</label>
            <GlassSelect value={pickedId} onChange={setPickedId} options={items.map((it) => ({ value: it.id, label: it.name }))} />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs text-white/60">Prix unitaire</label>
          <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/60">Quantité</label>
          <QuantityStepper value={quantity} onChange={setQuantity} min={1} />
        </div>

        <ImageDropzone label="Preuve (image optionnelle)" onChange={setProofFile} />

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-white/60">Description (optionnelle)</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[120px]" />
        </div>

        <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="text-sm text-white/70">Total</div>
          <div className="text-lg font-semibold">{Number.isFinite(total) ? total.toFixed(2) : '0.00'} $</div>
        </div>

        {error ? <div className="md:col-span-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">❌ {error}</div> : null}
        {pickedItem?.image_url ? (
          <div className="md:col-span-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="h-12 w-12 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pickedItem.image_url} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{pickedItem.name}</p>
              <p className="text-xs text-white/60">Prix par défaut: {Number(pickedItem.price || 0).toFixed(2)} $</p>
            </div>
          </div>
        ) : null}
      </div>
    </CenteredFormLayout>
  )
}
