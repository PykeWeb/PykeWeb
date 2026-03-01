'use client'

import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageDropzone } from '@/components/objets/ImageDropzone'
import { createExpensesBulk, type ExpenseItemType } from '@/lib/expensesApi'
import { listObjects, type DbObject } from '@/lib/objectsApi'
import { listWeapons, type DbWeapon } from '@/lib/weaponsApi'
import { listEquipment, type DbEquipment } from '@/lib/equipmentApi'
import { listDrugItems, type DbDrugItem } from '@/lib/drugsApi'

type ItemCat = Exclude<ExpenseItemType, 'custom'> | 'custom'

type PickItem = {
  type: ItemCat
  id: string
  name: string
  image_url?: string | null
  base_price: number
}

type CartLine = {
  type: ExpenseItemType
  item_ref_id?: string | null
  item_name: string
  image_url?: string | null
  unit_price: number
  quantity: number
}

function money(n: number) {
  const v = Number.isFinite(n) ? n : 0
  return v.toFixed(2)
}

export default function NouvelleDepensePage() {
  const router = useRouter()

  const [memberName, setMemberName] = useState('')
  const [category, setCategory] = useState<ItemCat>('object')
  const [search, setSearch] = useState('')

  const [items, setItems] = useState<PickItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  const [cart, setCart] = useState<Record<string, CartLine>>({})
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customQty, setCustomQty] = useState('1')

  const [description, setDescription] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoadingItems(true)
      setError(null)
      try {
        if (category === 'custom') {
          setItems([])
          return
        }

        if (category === 'object') {
          const data = await listObjects()
          setItems(
            data.map((o: DbObject) => ({ type: 'object', id: o.id, name: o.name, image_url: o.image_url, base_price: o.price }))
          )
        } else if (category === 'equipment') {
          const data = await listEquipment()
          setItems(
            data.map((e: DbEquipment) => ({ type: 'equipment', id: e.id, name: e.name, image_url: e.image_url, base_price: e.price }))
          )
        } else if (category === 'drug') {
          const data = await listDrugItems()
          setItems(
            data.map((d: DbDrugItem) => ({ type: 'drug', id: d.id, name: d.name, image_url: d.image_url, base_price: d.price }))
          )
        } else if (category === 'weapon') {
          const data = await listWeapons()
          setItems(
            data.map((w: DbWeapon) => ({
              type: 'weapon',
              id: w.id,
              name: w.name || w.weapon_id || 'Arme',
              image_url: w.image_url,
              base_price: 0,
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
  }, [category])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => it.name.toLowerCase().includes(q))
  }, [items, search])

  const cartLines = useMemo(() => Object.values(cart).filter((l) => l.quantity > 0), [cart])
  const total = useMemo(() => cartLines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0), [cartLines])

  const canSave = useMemo(() => {
    if (!memberName.trim()) return false

    const hasCart = cartLines.length > 0
    const hasCustom = category === 'custom' && customName.trim().length > 0 && Number(customQty) > 0
    return (hasCart || hasCustom) && !saving
  }, [memberName, cartLines.length, category, customName, customQty, saving])

  function upsertLine(it: PickItem, qtyDelta: number) {
    setCart((prev) => {
      const key = `${it.type}:${it.id}`
      const current = prev[key]
      const nextQty = Math.max(0, (current?.quantity || 0) + qtyDelta)
      const next: CartLine = {
        type: it.type as ExpenseItemType,
        item_ref_id: it.id,
        item_name: it.name,
        image_url: it.image_url,
        unit_price: current?.unit_price ?? it.base_price ?? 0,
        quantity: nextQty,
      }
      const copy = { ...prev }
      if (nextQty === 0) delete copy[key]
      else copy[key] = next
      return copy
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nouvelle dépense"
        subtitle="Choisis une catégorie, ajoute les items (+ / -), ajuste le prix si besoin, colle une preuve."
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            <label className="text-sm text-white/70">Catégorie</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as ItemCat)
                setSearch('')
              }}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20"
            >
              <option value="object">Objets</option>
              <option value="equipment">Équipement</option>
              <option value="drug">Drogues</option>
              <option value="weapon">Armes</option>
              <option value="custom">Autre (custom)</option>
            </select>
          </div>

          {category !== 'custom' ? (
            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-[280px] rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
                    placeholder="Rechercher un item…"
                  />
                  <p className="text-xs text-white/50">Clique + pour ajouter / - pour retirer.</p>
                </div>
                <div className="text-xs text-white/60">
                  {loadingItems ? 'Chargement…' : `${filtered.length} item(s)`}
                </div>
              </div>

              <div className="mt-3 max-h-[340px] overflow-auto rounded-2xl border border-white/10 bg-white/[0.03]">
                <table className="w-full text-sm">
                  <thead className="text-xs text-white/60">
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left">Item</th>
                      <th className="px-4 py-3 text-left">Prix</th>
                      <th className="px-4 py-3 text-right">Qté</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-white/50">
                          {loadingItems ? 'Chargement…' : 'Aucun item.'}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((it) => {
                        const key = `${it.type}:${it.id}`
                        const line = cart[key]
                        const qty = line?.quantity || 0
                        return (
                          <tr key={key} className="border-b border-white/10 last:border-none">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                  {it.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                                  ) : null}
                                </div>
                                <div>
                                  <div className="font-medium text-white/90">{it.name}</div>
                                  <div className="text-xs text-white/50">{it.type}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-white/80">{money(it.base_price)} $</td>
                            <td className="px-4 py-3 text-right text-white/80">{qty}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => upsertLine(it, -1)}
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold shadow-glow transition hover:bg-white/10"
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  onClick={() => upsertLine(it, +1)}
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold shadow-glow transition hover:bg-white/10"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="text-sm text-white/70">Nom de l'item (custom)</label>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
                  placeholder="Ex: location van / corruption…"
                />
              </div>
              <div>
                <label className="text-sm text-white/70">Qté</label>
                <input
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value)}
                  inputMode="numeric"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
                  placeholder="1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-white/70">Prix unitaire</label>
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/50">$</span>
                  <input
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    inputMode="decimal"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-7 pr-3 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Cart */}
          <div className="md:col-span-2">
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Panier</p>
                  <p className="text-xs text-white/50">Ajuste les prix si tu as acheté ailleurs (les totaux se recalculent).</p>
                </div>
                <div className="text-lg font-semibold">{money(total)} $</div>
              </div>

              {cartLines.length === 0 ? (
                <div className="mt-4 text-sm text-white/50">Aucun item dans le panier.</div>
              ) : (
                <div className="mt-4 overflow-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-white/60">
                      <tr className="border-b border-white/10">
                        <th className="px-4 py-3 text-left">Item</th>
                        <th className="px-4 py-3 text-left">Prix</th>
                        <th className="px-4 py-3 text-right">Qté</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartLines.map((l) => {
                        const key = `${l.type}:${l.item_ref_id}`
                        return (
                          <tr key={key} className="border-b border-white/10 last:border-none">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                  {l.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={l.image_url} alt={l.item_name} className="h-full w-full object-cover" />
                                  ) : null}
                                </div>
                                <div>
                                  <div className="font-medium text-white/90">{l.item_name}</div>
                                  <div className="text-xs text-white/50">{l.type}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="relative w-[140px]">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/50">$</span>
                                <input
                                  value={String(l.unit_price)}
                                  onChange={(e) => {
                                    const v = Number(e.target.value || 0)
                                    setCart((prev) => ({
                                      ...prev,
                                      [key]: { ...prev[key], unit_price: v },
                                    }))
                                  }}
                                  inputMode="decimal"
                                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-6 pr-3 text-sm outline-none focus:border-white/20"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCart((prev) => {
                                      const cur = prev[key]
                                      if (!cur) return prev
                                      const q = Math.max(0, cur.quantity - 1)
                                      const copy = { ...prev }
                                      if (q === 0) delete copy[key]
                                      else copy[key] = { ...cur, quantity: q }
                                      return copy
                                    })
                                  }}
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold shadow-glow transition hover:bg-white/10"
                                >
                                  -
                                </button>
                                <div className="w-10 text-center text-sm text-white/80">{l.quantity}</div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCart((prev) => {
                                      const cur = prev[key]
                                      if (!cur) return prev
                                      return { ...prev, [key]: { ...cur, quantity: cur.quantity + 1 } }
                                    })
                                  }}
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold shadow-glow transition hover:bg-white/10"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">{money(l.unit_price * l.quantity)} $</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <ImageDropzone label="Preuve (image optionnelle)" onChange={setProofFile} />

          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Description (optionnelle)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 min-h-[120px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
              placeholder="Ex: achat graines + pot + engrais…"
            />
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
                  const lines: CartLine[] = [...cartLines]
                  if (category === 'custom' && customName.trim()) {
                    lines.push({
                      type: 'custom',
                      item_ref_id: null,
                      item_name: customName.trim(),
                      unit_price: Number(customPrice || 0),
                      quantity: Number(customQty || 0),
                    })
                  }
                  await createExpensesBulk({
                    member_name: memberName.trim(),
                    description: description.trim() || undefined,
                    proofFile,
                    lines: lines.map((l) => ({
                      item_type: l.type,
                      item_ref_id: l.item_ref_id || null,
                      item_name: l.item_name,
                      unit_price: Number(l.unit_price),
                      quantity: Number(l.quantity),
                    })),
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
        </div>
      </Panel>
    </div>
  )
}
