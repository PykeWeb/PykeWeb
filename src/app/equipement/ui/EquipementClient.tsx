'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Pencil, ShoppingCart, Trash2 } from 'lucide-react'
import { Panel } from '@/components/ui/Panel'
import { listEquipment, adjustEquipmentStock, updateEquipment, deleteEquipment, type DbEquipment } from '@/lib/equipmentApi'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { DangerButton, PrimaryButton, SearchInput, SecondaryButton, TabPill } from '@/components/ui/design-system'

export default function EquipementClient() {
  const [items, setItems] = useState<DbEquipment[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editingItem, setEditingItem] = useState<DbEquipment | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editStock, setEditStock] = useState('0')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      setItems(await listEquipment())
    } catch (e: any) {
      setError(e?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((o) => (o.name || '').toLowerCase().includes(q))
  }, [items, query])

  const total = filtered.length

  function startEdit(item: DbEquipment) {
    setEditingItem(item)
    setEditName(item.name || '')
    setEditPrice(String(item.price ?? 0))
    setEditStock(String(Math.max(0, Number(item.stock ?? 0))))
    setEditImageFile(null)
    setError(null)
  }

  function cancelEdit() {
    setEditingItem(null)
    setEditName('')
    setEditPrice('')
    setEditStock('0')
    setEditImageFile(null)
  }

  async function saveEdit() {
    if (!editingItem) return
    if (!editName.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    if (Number.isNaN(Number(editPrice)) || Number(editPrice) < 0) {
      setError('Le prix doit être un nombre positif.')
      return
    }

    try {
      setSavingEdit(true)
      setError(null)
      await updateEquipment({
        id: editingItem.id,
        name: editName.trim(),
        price: Number(editPrice),
        quantity: Math.max(0, Math.floor(Number(editStock || 0) || 0)),
        imageFile: editImageFile,
      })
      await refresh()
      cancelEdit()
    } catch (e: any) {
      setError(e?.message || 'Erreur modification')
    } finally {
      setSavingEdit(false)
    }
  }

  async function removeItem(item: DbEquipment) {
    if (!window.confirm(`Supprimer définitivement "${item.name}" ?`)) return
    try {
      setError(null)
      await deleteEquipment(item.id)
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Erreur suppression')
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabPill active>Catalogue</TabPill>

          <div className="flex items-center gap-2">
            <Link href="/equipement/nouveau"><PrimaryButton size="lg">Ajouter un équipement</PrimaryButton></Link>
          </div>
        </div>

        {editingItem ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">Modifier l’équipement : {editingItem.name}</p>
              <div className="flex items-center gap-2">
                <SecondaryButton type="button" onClick={cancelEdit}>Annuler</SecondaryButton>
                <PrimaryButton type="button" disabled={savingEdit} onClick={saveEdit}>
                  {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
                </PrimaryButton>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs text-white/60">Nom</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Prix</label>
                <input
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Quantité</label>
                <input
                  value={editStock}
                  onChange={(e) => setEditStock(e.target.value)}
                  inputMode="numeric"
                  className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div className="mt-3">
              <p className="text-xs text-white/60">Image actuelle</p>
              <div className="mt-1 h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {editingItem.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={editingItem.image_url} className="h-full w-full object-cover" />
                ) : null}
              </div>
            </div>

            <ImageDropzone label="Remplacer l’image (optionnel)" onChange={setEditImageFile} />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-[300px]"
            placeholder="Rechercher…"
          />
          <div className="text-sm text-white/60">{total} équipement(s)</div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-white/70">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Équipement</th>
                <th className="px-4 py-3 text-left font-medium">Prix</th>
                <th className="px-4 py-3 text-left font-medium">Stock</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-white/60">
                    Chargement…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-white/60">
                    Aucun équipement pour le moment.
                  </td>
                </tr>
              ) : (
                filtered.map((it) => (
                  <tr key={it.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                          {it.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div>
                          <div className="font-semibold">{it.name}</div>
                          {it.description ? <div className="text-xs text-white/60 line-clamp-1">{it.description}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{Number(it.price).toFixed(2)} $</td>
                    <td className="px-4 py-3">{it.stock}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <SecondaryButton
                          disabled={busyId === it.id}
                          onClick={async () => {
                            setBusyId(it.id)
                            setError(null)
                            try {
                              await adjustEquipmentStock({ equipmentId: it.id, delta: 1, note: 'Achat' })
                              await refresh()
                            } catch (e: any) {
                              setError(e?.message || 'Erreur')
                            } finally {
                              setBusyId(null)
                            }
                          }}
                          icon={<ShoppingCart className="h-4 w-4" />}
                        >
                          Achat
                        </SecondaryButton>
                        <SecondaryButton
                          disabled={busyId === it.id}
                          onClick={async () => {
                            setBusyId(it.id)
                            setError(null)
                            try {
                              await adjustEquipmentStock({ equipmentId: it.id, delta: -1, note: 'Sortie' })
                              await refresh()
                            } catch (e: any) {
                              setError(e?.message || 'Erreur')
                            } finally {
                              setBusyId(null)
                            }
                          }}
                          icon={<ArrowUpRight className="h-4 w-4" />}
                        >
                          Sortie
                        </SecondaryButton>
                        <SecondaryButton onClick={() => startEdit(it)} icon={<Pencil className="h-4 w-4" />}>Modifier</SecondaryButton>
                        <DangerButton onClick={() => removeItem(it)} icon={<Trash2 className="h-4 w-4" />}>Supprimer</DangerButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            ❌ {error}
          </div>
        ) : null}
      </Panel>
    </div>
  )
}
