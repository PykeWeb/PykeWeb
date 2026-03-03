'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { listWeapons, adjustWeaponStock, updateWeapon, deleteWeapon, type DbWeapon } from '@/lib/weaponsApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DangerButton, IconButton, PrimaryButton, SecondaryButton, SearchInput, TabPill } from '@/components/ui/design-system'
import { toast } from 'sonner'
import { ArrowLeft, ArrowUpRight, Handshake, Pencil, ShoppingCart, Trash2 } from 'lucide-react'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'

export function ArmesClient() {
  const [items, setItems] = useState<DbWeapon[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const [editingItem, setEditingItem] = useState<DbWeapon | null>(null)
  const [editName, setEditName] = useState('')
  const [editWeaponId, setEditWeaponId] = useState('')
  const [editStock, setEditStock] = useState('0')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const data = await listWeapons()
      setItems(data)
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de charger les armes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return items
    return items.filter((w) => (w.name || '').toLowerCase().includes(query) || (w.weapon_id || '').toLowerCase().includes(query))
  }, [items, q])

  function startEdit(item: DbWeapon) {
    setEditingItem(item)
    setEditName(item.name || '')
    setEditWeaponId(item.weapon_id || '')
    setEditStock(String(Math.max(0, Number(item.stock ?? 0))))
    setEditImageFile(null)
  }

  function cancelEdit() {
    setEditingItem(null)
    setEditName('')
    setEditWeaponId('')
    setEditStock('0')
    setEditImageFile(null)
  }

  async function saveEdit() {
    if (!editingItem) return

    try {
      setSavingEdit(true)
      await updateWeapon({
        id: editingItem.id,
        name: editName.trim() || null,
        weapon_id: editWeaponId.trim() || null,
        quantity: Math.max(0, Math.floor(Number(editStock || 0) || 0)),
        imageFile: editImageFile,
      })
      await refresh()
      toast.success('Arme modifiée')
      cancelEdit()
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de modifier')
    } finally {
      setSavingEdit(false)
    }
  }

  async function removeItem(item: DbWeapon) {
    if (!window.confirm(`Supprimer définitivement "${item.name || 'cette arme'}" ?`)) return
    try {
      await deleteWeapon(item.id)
      await refresh()
      toast.success('Arme supprimée')
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de supprimer')
    }
  }

  async function bump(id: string, delta: number) {
    try {
      await adjustWeaponStock({ weaponId: id, delta })
      await refresh()
      toast.success(delta > 0 ? 'Stock +1' : 'Stock -1')
    } catch (e: any) {
      toast.error(e?.message || 'Erreur stock')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <SecondaryButton icon={<ArrowLeft className="h-4 w-4" />}>Retour</SecondaryButton>
            </Link>
            <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom ou ID)..." className="w-[320px]" />
            <span className="text-sm text-white/60">{filtered.length} arme(s)</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link href="/armes/nouveau" className="block">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
              <p className="text-lg font-semibold">Ajouter une arme</p>
              <p className="mt-1 text-sm text-white/60">Catalogue armes</p>
            </div>
          </Link>
          <Link href="/armes/prets" className="block">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
              <p className="text-lg font-semibold">Prêts en cours</p>
              <p className="mt-1 text-sm text-white/60">Voir / gérer les prêts</p>
            </div>
          </Link>
          <Link href="/armes/prets/nouveau" className="block">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
              <p className="text-lg font-semibold">Créer un prêt</p>
              <p className="mt-1 text-sm text-white/60">Nouveau prêt d’arme</p>
            </div>
          </Link>
        </div>

        {editingItem ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">Modifier l’arme : {editingItem.name || 'Sans nom'}</p>
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
                <label className="text-xs text-white/60">ID arme</label>
                <input
                  value={editWeaponId}
                  onChange={(e) => setEditWeaponId(e.target.value)}
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

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-white/70">
              <tr>
                <th className="px-4 py-3">Arme</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-white/60" colSpan={4}>
                    Chargement…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-white/60" colSpan={4}>
                    Aucune arme pour le moment.
                  </td>
                </tr>
              ) : (
                filtered.map((w) => (
                  <tr key={w.id} className="border-t border-white/10">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                          {w.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={w.image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-white/10 to-white/[0.02]" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{w.name || 'Sans nom'}</p>
                          {w.description ? <p className="text-xs text-white/60 line-clamp-1">{w.description}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/70">{w.weapon_id || '—'}</td>
                    <td className="px-4 py-3 font-semibold">{w.stock}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => bump(w.id, +1)}>
                          <ShoppingCart className="h-4 w-4" />
                          Achat
                        </Button>
                        <Button variant="ghost" onClick={() => bump(w.id, -1)} disabled={w.stock <= 0}>
                          <ArrowUpRight className="h-4 w-4" />
                          Sortie
                        </Button>
                        <Link href={`/armes/prets/nouveau?weapon=${w.id}`}>
                          <Button variant="secondary">
                            <Handshake className="h-4 w-4" />
                            Prêter
                          </Button>
                        </Link>
                        <Button variant="secondary" onClick={() => startEdit(w)}>
                          <Pencil className="h-4 w-4" />
                          Modifier
                        </Button>
                        <DangerButton type="button" onClick={() => removeItem(w)} icon={<Trash2 className="h-4 w-4" />}>Supprimer</DangerButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
