'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CenteredFormLayout } from '@/components/ui/CenteredFormLayout'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { PrimaryButton, SecondaryButton, SearchInput, TabPill } from '@/components/ui/design-system'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { createExpense, type ExpenseItemType } from '@/lib/expensesApi'
import { listObjects, type DbObject } from '@/lib/objectsApi'
import { listWeapons, type DbWeapon } from '@/lib/weaponsApi'
import { listEquipment, type DbEquipment } from '@/lib/equipmentApi'
import { listDrugItems, type DbDrugItem } from '@/lib/drugsApi'

type PickItem = {
  type: Exclude<ExpenseItemType, 'custom'>
  id: string
  name: string
  price: number
  image_url?: string | null
}

type SelectedExpenseItem = PickItem & {
  selectionKey: string
  quantity: number
  unitPrice: number
}

const catalogTypeOptions: Array<{ value: Exclude<ExpenseItemType, 'custom'>; label: string }> = [
  { value: 'objects', label: 'Objets' },
  { value: 'weapons', label: 'Armes' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'drugs', label: 'Drogues' },
]

export function NouvelleDepenseForm({
  backHref = '/depenses',
  successHref = '/depenses',
  title = 'Nouvelle dépense',
  actionsPlacement = 'bottom-right',
}: {
  backHref?: string
  successHref?: string
  title?: string
  actionsPlacement?: 'top-right' | 'bottom-right'
}) {
  const router = useRouter()

  const [memberName, setMemberName] = useState('')
  const [itemType, setItemType] = useState<Exclude<ExpenseItemType, 'custom'>>('objects')
  const [useTemporaryItem, setUseTemporaryItem] = useState(false)
  const [items, setItems] = useState<PickItem[]>([])
  const [pickedId, setPickedId] = useState<string>('')
  const [selectedItems, setSelectedItems] = useState<SelectedExpenseItem[]>([])
  const [itemQuery, setItemQuery] = useState('')
  const [temporaryName, setTemporaryName] = useState('')
  const [unitPrice, setUnitPrice] = useState<string>('0')
  const [quantity, setQuantity] = useState(1)
  const [description, setDescription] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = useMemo(() => {
    if (!useTemporaryItem) {
      return selectedItems.reduce((sum, item) => sum + Math.max(1, item.quantity) * Math.max(0, item.unitPrice), 0)
    }
    return Number(unitPrice || 0) * Number(quantity || 0)
  }, [selectedItems, unitPrice, quantity, useTemporaryItem])
  const pickedItem = useMemo(() => items.find((x) => x.id === pickedId) || null, [items, pickedId])

  const getSelectionKey = (item: PickItem) => `${item.type}:${item.id}`

  const filteredItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase()
    if (!query) return items
    return items.filter((item) => item.name.toLowerCase().includes(query))
  }, [items, itemQuery])

  const canSave = useMemo(() => {
    if (!memberName.trim()) return false
    if (useTemporaryItem) return temporaryName.trim().length > 0 && Number(unitPrice) >= 0 && quantity > 0 && !saving
    return selectedItems.length > 0 && !saving
  }, [memberName, useTemporaryItem, temporaryName, unitPrice, quantity, selectedItems, saving])

  useEffect(() => {
    async function load() {
      setError(null)
      try {
        if (itemType === 'objects') {
          const data = await listObjects()
          setItems(data.map((o: DbObject) => ({ type: 'objects', id: o.id, name: o.name, price: o.price, image_url: o.image_url })))
          return
        }
        if (itemType === 'weapons') {
          const data = await listWeapons()
          setItems(data.map((w: DbWeapon) => ({ type: 'weapons', id: w.id, name: w.name || w.weapon_id || 'Arme', price: 0, image_url: w.image_url })))
          return
        }
        if (itemType === 'equipment') {
          const data = await listEquipment()
          setItems(data.map((e: DbEquipment) => ({ type: 'equipment', id: e.id, name: e.name, price: e.price, image_url: e.image_url })))
          return
        }
        const data = await listDrugItems()
        setItems(data.map((d: DbDrugItem) => ({ type: 'drugs', id: d.id, name: d.name, price: d.price, image_url: d.image_url })))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erreur')
      }
    }

    setPickedId('')
    setItemQuery('')
    void load()
  }, [itemType])

  useEffect(() => {
    if (useTemporaryItem || !pickedId) return
    const item = items.find((x) => x.id === pickedId)
    if (item) setUnitPrice(String(item.price ?? 0))
  }, [pickedId, items, useTemporaryItem])

  function toggleSelectedItem(item: PickItem) {
    const selectionKey = getSelectionKey(item)
    setPickedId(item.id)
    setSelectedItems((prev) => {
      const existing = prev.find((entry) => entry.selectionKey === selectionKey)
      if (existing) {
        return prev.filter((entry) => entry.selectionKey !== selectionKey)
      }
      return [...prev, { ...item, selectionKey, quantity: 1, unitPrice: Math.max(0, Number(item.price || 0) || 0) }]
    })
  }

  return (
    <CenteredFormLayout
      title={title}
      actions={
        <>
          <Link href={backHref}><SecondaryButton>Retour</SecondaryButton></Link>
          <PrimaryButton
            disabled={!canSave}
            onClick={async () => {
              setSaving(true)
              setError(null)
              try {
                const item = useTemporaryItem ? null : selectedItems[0] || null
                const totalQuantity = !useTemporaryItem
                  ? selectedItems.reduce((sum, row) => sum + Math.max(1, row.quantity), 0)
                  : quantity
                const totalAmount = !useTemporaryItem
                  ? selectedItems.reduce((sum, row) => sum + Math.max(1, row.quantity) * Math.max(0, row.unitPrice), 0)
                  : Number(unitPrice) * quantity
                const normalizedUnit = totalQuantity > 0 ? totalAmount / totalQuantity : 0
                const multiLabel = selectedItems.length > 1 ? 'Multiple' : item?.name || 'Item'
                const isMultiCatalogExpense = !useTemporaryItem && selectedItems.length > 1
                const mergedDescription = !useTemporaryItem && selectedItems.length > 1
                  ? `${description.trim() || ''}${description.trim() ? '\n\n' : ''}Items:\n${selectedItems.map((row) => `- ${row.name} × ${Math.max(1, row.quantity)}`).join('\n')}`
                  : description.trim()
                await createExpense({
                  member_name: memberName.trim(),
                  item_source: useTemporaryItem || isMultiCatalogExpense ? 'custom' : itemType,
                  item_id: useTemporaryItem || selectedItems.length !== 1 ? null : item?.id || null,
                  item_label: useTemporaryItem ? temporaryName.trim() : multiLabel,
                  unit_price: useTemporaryItem ? Number(unitPrice) : normalizedUnit,
                  default_unit_price: useTemporaryItem ? null : normalizedUnit,
                  quantity: useTemporaryItem ? quantity : Math.max(1, totalQuantity),
                  description: mergedDescription || undefined,
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
      actionsPlacement={actionsPlacement}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-white/60">Nom du membre</label>
          <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Ex: Pyke" />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-xs text-white/60">Catégorie</label>
          <div className="flex flex-wrap gap-2">
            {catalogTypeOptions.map((option) => (
              <TabPill
                key={option.value}
                active={!useTemporaryItem && itemType === option.value}
                onClick={() => {
                  setUseTemporaryItem(false)
                  setItemType(option.value)
                }}
              >
                {option.label}
              </TabPill>
            ))}
            <TabPill active={useTemporaryItem} onClick={() => setUseTemporaryItem(true)}>
              Autres
            </TabPill>
          </div>
        </div>

        {useTemporaryItem ? (
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-white/60">Nom provisoire</label>
            <Input value={temporaryName} onChange={(e) => setTemporaryName(e.target.value)} placeholder="Ex: Réparation véhicule (provisoire)" />
          </div>
        ) : (
          <>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-white/60">Rechercher dans le catalogue</label>
              <SearchInput value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} placeholder="Chercher un item..." />
            </div>
            <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleSelectedItem(item)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                      selectedItems.some((entry) => entry.selectionKey === getSelectionKey(item)) ? 'border-cyan-300/40 bg-cyan-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                        {item.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-[10px] text-white/40">IMG</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.name}</div>
                        <div className="text-xs text-white/60">Prix catalogue: {Number(item.price || 0).toFixed(2)} $</div>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredItems.length === 0 ? <p className="px-2 py-2 text-xs text-white/60">Aucun item trouvé.</p> : null}
              </div>
            </div>
          </>
        )}

        {useTemporaryItem ? (
          <>
            <div>
              <label className="mb-1 block text-xs text-white/60">Prix unitaire</label>
              <Input value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} inputMode="decimal" />
            </div>

            <div>
              <label className="mb-1 block text-xs text-white/60">Quantité</label>
              <QuantityStepper value={quantity} onChange={setQuantity} min={1} />
            </div>
          </>
        ) : (
          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-2 text-xs text-white/60">Items sélectionnés</p>
            <div className="space-y-2">
              {selectedItems.map((item) => (
                <div key={item.selectionKey} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2">
                  <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[10px] text-white/40">IMG</div>
                    )}
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-white/60">{item.unitPrice.toFixed(2)} $ / unité</p>
                  </div>
                  <div className="w-[170px]">
                    <QuantityStepper
                      value={item.quantity}
                      min={1}
                      onChange={(nextQty) => setSelectedItems((prev) => prev.map((row) => row.selectionKey === item.selectionKey ? { ...row, quantity: nextQty } : row))}
                    />
                  </div>
                  <SecondaryButton onClick={() => setSelectedItems((prev) => prev.filter((row) => row.selectionKey !== item.selectionKey))}>Retirer</SecondaryButton>
                </div>
              ))}
              {selectedItems.length === 0 ? <p className="text-xs text-white/55">Sélectionne un ou plusieurs objets dans la liste.</p> : null}
            </div>
          </div>
        )}

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
        {pickedItem?.image_url && !useTemporaryItem && selectedItems.length === 1 ? (
          <div className="md:col-span-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="h-12 w-12 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pickedItem.image_url} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{pickedItem.name}</p>
              <p className="text-xs text-white/60">Prix catalogue: {Number(pickedItem.price || 0).toFixed(2)} $</p>
            </div>
          </div>
        ) : null}
      </div>
    </CenteredFormLayout>
  )
}
