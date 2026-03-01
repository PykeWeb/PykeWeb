'use client'

import { Panel } from '@/components/ui/Panel'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageDropzone } from '@/components/objets/ImageDropzone'
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

export default function NouvelleDepensePage() {
  const router = useRouter()

  const [memberName, setMemberName] = useState('')
  const [itemType, setItemType] = useState<ExpenseItemType>('objects')
  const [items, setItems] = useState<PickItem[]>([])
  const [pickedId, setPickedId] = useState<string>('')
  const [customName, setCustomName] = useState('')
  const [unitPrice, setUnitPrice] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('1')
  const [description, setDescription] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const [loadingItems, setLoadingItems] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = useMemo(() => Number(unitPrice || 0) * Number(quantity || 0), [unitPrice, quantity])
  const pickedItem = useMemo(() => items.find((x) => x.id === pickedId) || null, [items, pickedId])

  const canSave = useMemo(() => {
    if (!memberName.trim()) return false
    if (itemType === 'custom') return customName.trim().length > 0 && Number(unitPrice) >= 0 && Number(quantity) > 0 && !saving
    return pickedId.length > 0 && Number(unitPrice) >= 0 && Number(quantity) > 0 && !saving
  }, [memberName, itemType, customName, unitPrice, quantity, pickedId, saving])

  useEffect(() => {
    async function load() {
      setLoadingItems(true)
      setError(null)
      try {
        if (itemType === 'custom') {
          setItems([])
          setPickedId('')
          return
        }

        if (itemType === 'objects') {
          const data = await listObjects()
          setItems(
            data.map((o: DbObject) => ({
              type: 'objects',
              id: o.id,
              name: o.name,
              price: o.price,
              image_url: o.image_url,
            }))
          )
        } else if (itemType === 'weapons') {
          const data = await listWeapons()
          setItems(
            data.map((w: DbWeapon) => ({
              type: 'weapons',
              id: w.id,
              name: w.name || w.weapon_id || 'Arme',
              price: 0,
              image_url: w.image_url,
            }))
          )
        } else if (itemType === 'equipment') {
          const data = await listEquipment()
          setItems(
            data.map((e: DbEquipment) => ({
              type: 'equipment',
              id: e.id,
              name: e.name,
              price: e.price,
              image_url: e.image_url,
            }))
          )
        } else if (itemType === 'drugs') {
          const data = await listDrugItems()
          setItems(
            data.map((d: DbDrugItem) => ({
              type: 'drugs',
              id: d.id,
              name: d.name,
              price: d.price,
              image_url: d.image_url,
            }))
          )
        }
      } catch (e: any) {
        setError(e?.message || 'Erreur')
      } finally {
        setLoadingItems(false)
      }
    }
    load()
  }, [itemType])

  useEffect(() => {
    if (itemType === 'custom') return
    if (!pickedId) return
    const it = items.find((x) => x.id === pickedId)
    if (it) {
      setUnitPrice(String(it.price ?? 0))
    }
  }, [pickedId, items, itemType])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nouvelle dépense"
        subtitle="Nom du membre • item • quantité • preuve • statut"
        actions={
          <Link
            href="/depenses"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium shadow-glow transition hover:bg-white/10"
          >
            Retour
          </Link>
        }
      />

      <Panel>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Nom du membre</label>
            <input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
              placeholder="Ex: Pyke"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Type d'item</label>
            <select
              value={itemType}
              onChange={(e) => setItemType(e.target.value as ExpenseItemType)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20"
            >
              <option value="objects">Objets</option>
              <option value="weapons">Armes (prix = 0 par défaut)</option>
              <option value="equipment">Équipement</option>
              <option value="drugs">Drogues</option>
              <option value="custom">Custom (autre item)</option>
            </select>
          </div>

          {itemType === 'custom' ? (
            <div className="md:col-span-2">
              <label className="text-sm text-white/70">Nom de l'item</label>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
                placeholder="Ex: Location van / Corruption…"
              />
            </div>
          ) : (
            <div className="md:col-span-2">
              <label className="text-sm text-white/70">Item</label>
              <select
                value={pickedId}
                onChange={(e) => setPickedId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20"
                disabled={loadingItems}
              >
                <option value="">{loadingItems ? 'Chargement…' : 'Choisir un item'}</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>

              {pickedItem?.image_url ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
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

              <p className="mt-2 text-xs text-white/50">Le prix se remplit automatiquement mais tu peux le modifier.</p>
            </div>
          )}

          <div>
            <label className="text-sm text-white/70">Prix unitaire</label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/50">$</span>
              <input
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-7 pr-3 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-white/70">Quantité</label>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="h-11 w-11 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => {
                  const q = Math.max(1, Number(quantity || 1) - 1)
                  setQuantity(String(q))
                }}
              >
                −
              </button>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="numeric"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
                placeholder="1"
              />
              <button
                type="button"
                className="h-11 w-11 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => {
                  const q = Math.max(1, Number(quantity || 1) + 1)
                  setQuantity(String(q))
                }}
              >
                +
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <ImageDropzone label="Preuve (image optionnelle)" onChange={setProofFile} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Description (optionnelle)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 min-h-[120px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
              placeholder="Ex: achat graines + pot + engrais…"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="text-sm text-white/70">Total</div>
            <div className="text-lg font-semibold">{Number.isFinite(total) ? total.toFixed(2) : '0.00'} $</div>
          </div>

          {error ? (
            <div className="md:col-span-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              ❌ {error}
            </div>
          ) : null}

          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <Link
              href="/depenses"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium shadow-glow transition hover:bg-white/10"
            >
              Annuler
            </Link>
            <button
              type="button"
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
                    quantity: Number(quantity),
                    description: description.trim() || undefined,
                    proofFile,
                  })
                  router.push('/depenses')
                  router.refresh()
                } catch (e: any) {
                  setError(e?.message || 'Erreur')
                } finally {
                  setSaving(false)
                }
              }}
              className={
                'rounded-xl px-4 py-2.5 text-sm font-semibold shadow-glow transition ' +
                (canSave ? 'bg-white text-black hover:bg-white/90' : 'bg-white/20 text-white/50')
              }
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  )
}
