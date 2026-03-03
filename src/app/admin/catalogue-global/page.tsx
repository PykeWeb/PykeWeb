'use client'

import { useEffect, useMemo, useState } from 'react'
import { getTenantSession } from '@/lib/tenantSession'
import { supabase } from '@/lib/supabase/client'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'
import { GlassSelect } from '@/components/ui/GlassSelect'

type Category = 'object' | 'weapon' | 'equipment' | 'drug'

type GlobalItem = {
  id: string
  category: Category
  item_type: string | null
  name: string
  price: number
  default_quantity: number
  image_url: string | null
  weapon_id: string | null
}

export default function AdminCatalogueGlobalPage() {
  const [items, setItems] = useState<GlobalItem[]>([])
  const [category, setCategory] = useState<Category>('object')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('0')
  const [quantity, setQuantity] = useState('0')
  const [weaponId, setWeaponId] = useState('')
  const [drugType, setDrugType] = useState('drug')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const res = await fetch('/api/admin/global-catalog', { cache: 'no-store' })
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    const session = getTenantSession()
    if (!session?.isAdmin) {
      window.location.href = '/'
      return
    }
    void refresh()
  }, [])

  async function uploadImage(file: File) {
    const ext = file.type.includes('png') ? 'png' : 'jpg'
    const path = `global/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('global-item-images').upload(path, file, { upsert: true, contentType: file.type || undefined })
    if (uploadErr) throw uploadErr
    const { data } = supabase.storage.from('global-item-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function addItem() {
    if (!name.trim()) return
    try {
      setBusy(true)
      setError(null)
      const image_url = imageFile ? await uploadImage(imageFile) : null
      const res = await fetch('/api/admin/global-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          name: name.trim(),
          price: Number(price || 0),
          default_quantity: Math.max(0, Math.floor(Number(quantity || 0) || 0)),
          weapon_id: category === 'weapon' ? weaponId.trim() || null : null,
          item_type: category === 'drug' ? drugType : null,
          image_url,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setName('')
      setPrice('0')
      setQuantity('0')
      setWeaponId('')
      setImageFile(null)
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Erreur création')
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(id: string) {
    const res = await fetch('/api/admin/global-catalog', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!res.ok) return
    await refresh()
  }

  const filtered = useMemo(() => items.filter((it) => it.category === category), [items, category])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <h1 className="text-2xl font-semibold">Objets (catalogue global)</h1>
        <p className="mt-1 text-sm text-white/70">Création centralisée (Objets / Armes / Équipement / Drogues) avec override local par groupe.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-white/60">Catégorie</label>
            <GlassSelect className="mt-1" value={category} onChange={(v) => setCategory(v as Category)} options={[{ value: 'object', label: 'Objets' }, { value: 'weapon', label: 'Armes' }, { value: 'equipment', label: 'Équipement' }, { value: 'drug', label: 'Drogues' }]} />
          </div>
          <div>
            <label className="text-xs text-white/60">Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60">Prix ($)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Prix ($)" className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60">Quantité</label>
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantité" className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
          </div>
          {category === 'weapon' ? (
            <div>
              <label className="text-xs text-white/60">Weapon ID / hash</label>
              <input value={weaponId} onChange={(e) => setWeaponId(e.target.value)} placeholder="Weapon ID / hash" className="mt-1 h-10 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-3 text-sm" />
            </div>
          ) : null}
          {category === 'drug' ? (
            <div>
              <label className="text-xs text-white/60">Type</label>
              <GlassSelect className="mt-1" value={drugType} onChange={setDrugType} options={[{ value: 'drug', label: 'Coke/Meth/Weed' }, { value: 'seed', label: 'Graine' }, { value: 'planting', label: 'Plantation' }, { value: 'pouch', label: 'Pochon' }, { value: 'other', label: 'Autre' }]} />
            </div>
          ) : null}
          <ImageDropzone label="Image (PNG/JPEG)" onChange={setImageFile} />
        </div>

        <button disabled={busy} onClick={() => void addItem()} className="mt-3 h-10 rounded-2xl border border-white/15 bg-white/[0.09] px-4 text-sm font-semibold hover:bg-white/[0.14]">
          {busy ? 'Ajout...' : 'Ajouter'}
        </button>
        {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <h2 className="text-lg font-semibold">Items {category}</h2>
        <div className="mt-3 space-y-2">
          {filtered.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                  {it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <p>{it.name} <span className="text-white/60">{Number(it.price || 0).toFixed(2)}$ • qté {it.default_quantity}</span></p>
              </div>
              <button onClick={() => void removeItem(it.id)} className="h-10 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 text-sm text-rose-200 hover:bg-rose-500/20">Supprimer</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
