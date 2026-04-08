'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CenteredFormLayout } from '@/components/ui/CenteredFormLayout'
import { Input } from '@/components/ui/Input'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { PrimaryButton, SecondaryButton, SearchInput, TabPill } from '@/components/ui/design-system'
import { MemberSelect } from '@/components/ui/MemberSelect'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { createExpense, type ExpenseItemType } from '@/lib/expensesApi'
import { listCatalogItemsUnified } from '@/lib/itemsApi'
import { getTenantSession } from '@/lib/tenantSession'

type PickItem = {
  type: ExpenseItemType
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

const ITEMS_JSON_MARKER = '__ITEMS_JSON__:'

const catalogTypeOptions: Array<{ value: ExpenseItemType; label: string }> = [
  { value: 'objects', label: 'Objets' },
  { value: 'weapons', label: 'Armes' },
  { value: 'equipment', label: 'Équipement' },
  { value: 'drugs', label: 'Drogues' },
  { value: 'custom', label: 'Autres' },
]

async function enrichMissingImagesByName(category: ExpenseItemType, baseItems: PickItem[]) {
  const missing = baseItems.filter((item) => !item.image_url).length
  if (missing === 0) return baseItems

  try {
    const catalogItems = await listCatalogItemsUnified()
    const byLegacyId = new Map(
      catalogItems
        .filter((row) => row.category === category && row.id.startsWith(`legacy:${category}:`) && !!row.image_url)
        .map((row) => [row.id.slice(`legacy:${category}:`.length), row.image_url || null])
    )
    const byName = new Map(
      catalogItems
        .filter((row) => row.category === category && !!row.image_url)
        .map((row) => [String(row.name || '').trim().toLowerCase(), row.image_url || null])
    )

    return baseItems.map((item) => {
      if (item.image_url) return item
      const imageByLegacyId = byLegacyId.get(item.id)
      if (imageByLegacyId) return { ...item, image_url: imageByLegacyId }
      const imageUrl = byName.get(item.name.trim().toLowerCase())
      return imageUrl ? { ...item, image_url: imageUrl } : item
    })
  } catch {
    return baseItems
  }
}

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
  const [memberOptions, setMemberOptions] = useState<string[]>([])
  const [itemType, setItemType] = useState<ExpenseItemType>('objects')
  const [useTemporaryItem, setUseTemporaryItem] = useState(false)
  const [items, setItems] = useState<PickItem[]>([])
  const [selectedItems, setSelectedItems] = useState<SelectedExpenseItem[]>([])
  const [itemQuery, setItemQuery] = useState('')
  const [temporaryName, setTemporaryName] = useState('')
  const [unitPrice, setUnitPrice] = useState<string>('0')
  const [quantity, setQuantity] = useState(1)
  const [description, setDescription] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const memberSelectOptions = useMemo(() => {
    const current = memberName.trim()
    if (!current) return memberOptions
    return memberOptions.some((name) => name.toLowerCase() === current.toLowerCase()) ? memberOptions : [current, ...memberOptions]
  }, [memberName, memberOptions])

  const total = useMemo(() => {
    if (!useTemporaryItem) {
      return selectedItems.reduce((sum, item) => sum + Math.max(1, item.quantity) * Math.max(0, item.unitPrice), 0)
    }
    return Number(unitPrice || 0) * Number(quantity || 0)
  }, [selectedItems, unitPrice, quantity, useTemporaryItem])

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
    const sessionMember = String(getTenantSession()?.memberName || '').trim()
    if (sessionMember) setMemberName(sessionMember)
    void fetch('/api/group/members', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return []
        const payload = (await res.json()) as { members?: string[] }
        return Array.isArray(payload.members) ? payload.members : []
      })
      .then((rows) => setMemberOptions(rows))
      .catch(() => setMemberOptions([]))
  }, [])

  useEffect(() => {
    async function load() {
      setError(null)
      try {
        const category = itemType
        const data = await listCatalogItemsUnified()
        const mapped: PickItem[] = data
          .filter((row) => row.category === category && row.is_active)
          .map((row) => ({
            type: category,
            id: row.id,
            name: row.name,
            price: Math.max(0, Number(row.buy_price || row.internal_value || row.sell_price || 0)),
            image_url: row.image_url,
          }))
        setItems(await enrichMissingImagesByName(category, mapped))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erreur')
      }
    }

    setItemQuery('')
    void load()
  }, [itemType])

  function toggleSelectedItem(item: PickItem) {
    const selectionKey = getSelectionKey(item)
    setSelectedItems((prev) => {
      const existing = prev.find((entry) => entry.selectionKey === selectionKey)
      if (existing) {
        return prev.filter((entry) => entry.selectionKey !== selectionKey)
      }
      return [...prev, { ...item, selectionKey, quantity: 1, unitPrice: Math.max(0, Number(item.price || 0) || 0) }]
    })
  }

  function updateSelectedItemUnitPrice(selectionKey: string, rawPrice: string) {
    setSelectedItems((prev) =>
      prev.map((row) => {
        if (row.selectionKey !== selectionKey) return row
        const parsed = Number(rawPrice)
        return {
          ...row,
          unitPrice: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
        }
      })
    )
  }

  async function submitExpense() {
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
        ? `${description.trim() || ''}${description.trim() ? '\n\n' : ''}Items:\n${selectedItems.map((row) => `- ${row.name} × ${Math.max(1, row.quantity)}`).join('\n')}\n\n${ITEMS_JSON_MARKER}${JSON.stringify(selectedItems.map((row) => ({
          name: row.name,
          quantity: Math.max(1, row.quantity),
          unit_price: Math.max(0, row.unitPrice),
          image_url: row.image_url || null,
          item_source: row.type,
          item_id: row.id,
        })))}`
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
  }

  return (
    <CenteredFormLayout
      className="max-h-[calc(100dvh-9.75rem)]"
      panelClassName="h-full overflow-hidden"
      title={title}
      actions={actionsPlacement === 'top-right' ? undefined : (
        <>
          <Link href={backHref}><SecondaryButton>Retour</SecondaryButton></Link>
          <PrimaryButton disabled={!canSave} onClick={() => void submitExpense()}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </PrimaryButton>
        </>
      )}
      actionsPlacement={actionsPlacement}
    >
      <div className="grid h-full gap-3 md:grid-cols-2">
        <div className="md:col-span-2 grid gap-3 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
          <div>
            <label className="mb-1 block text-xs text-white/60">Membre</label>
            <MemberSelect value={memberName} onChange={setMemberName} options={memberSelectOptions} />
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/60">Raison / note</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Pourquoi cette dépense ?" className="h-10" />
          </div>

          {actionsPlacement === 'top-right' ? (
            <div className="flex items-end justify-end gap-2">
              <Link href={backHref}><SecondaryButton>Retour</SecondaryButton></Link>
              <PrimaryButton disabled={!canSave} onClick={() => void submitExpense()}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </PrimaryButton>
            </div>
          ) : null}
        </div>

        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              onClick={() => {
                setUseTemporaryItem(true)
                setTemporaryName((prev) => prev || itemQuery.trim())
              }}
              className="inline-flex h-8 items-center rounded-xl border border-fuchsia-300/35 bg-fuchsia-500/12 px-3 text-xs font-semibold text-fuchsia-100 hover:bg-fuchsia-500/20"
            >
              Item absent ? Saisie libre
            </button>
          </div>
          <div className="ml-auto inline-flex h-8 items-center rounded-xl border border-white/20 bg-white/[0.05] px-3 text-right text-xs">
            <span className="text-sm font-semibold text-white">{`Total : ${Number.isFinite(total) ? total.toFixed(2) : '0.00'} $`}</span>
          </div>
        </div>

        {useTemporaryItem ? (
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-white/60">Nom provisoire</label>
            <Input value={temporaryName} onChange={(e) => setTemporaryName(e.target.value)} placeholder="Ex: Réparation véhicule (provisoire)" />
            <p className="mt-1 text-xs text-white/60">Tu peux créer une dépense avec n’importe quel nom et n’importe quel prix.</p>
          </div>
        ) : (
          <div className="md:col-span-2 grid gap-3 lg:grid-cols-[1fr_380px]">
            <div>
              <label className="mb-1 block text-xs text-white/60">Rechercher dans le catalogue</label>
              <SearchInput value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} placeholder="Chercher un item..." />
              <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                <div className="h-[clamp(14rem,34dvh,20rem)] space-y-1 overflow-y-auto pr-1">
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
            </div>

            <div className="self-start rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="max-h-[clamp(14rem,30dvh,18rem)] space-y-2 overflow-y-auto pr-1">
                {selectedItems.map((item) => (
                  <div key={item.selectionKey} className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                        {item.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-[10px] text-white/40">IMG</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-white/60">{item.unitPrice.toFixed(2)} $ / unité</p>
                      </div>
                      <SecondaryButton onClick={() => setSelectedItems((prev) => prev.filter((row) => row.selectionKey !== item.selectionKey))}>Retirer</SecondaryButton>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <QuantityStepper
                        size="sm"
                        fitContent
                        value={item.quantity}
                        min={1}
                        onChange={(nextQty) => setSelectedItems((prev) => prev.map((row) => row.selectionKey === item.selectionKey ? { ...row, quantity: nextQty } : row))}
                      />
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={String(item.unitPrice)}
                          onChange={(event) => updateSelectedItemUnitPrice(item.selectionKey, event.target.value)}
                          inputMode="decimal"
                          className="h-8 w-[92px] px-2 text-center"
                        />
                        <span className="text-sm font-semibold text-white/85">$</span>
                      </div>
                    </div>
                  </div>
                ))}
                {selectedItems.length === 0 ? <p className="text-xs text-white/55">Sélectionne un ou plusieurs objets dans la liste.</p> : null}
              </div>
            </div>
          </div>
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
        ) : null}

        <ImageDropzone label="Preuve (image optionnelle)" onChange={setProofFile} compact />

        {error ? <div className="md:col-span-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">❌ {error}</div> : null}
      </div>
    </CenteredFormLayout>
  )
}
