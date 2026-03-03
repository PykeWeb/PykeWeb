'use client'

import { useEffect, useMemo, useState } from 'react'
import { getTenantSession } from '@/lib/tenantSession'
import { supabase } from '@/lib/supabaseClient'

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
          default_quantity: Math.max(0, Number(quantity || 0)),
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
        <h1 className="text-2xl font-semibold">Catalogue global</h1>
        <p className="mt-1 text-sm text-white/70">Création centralisée (Objets / Armes / Équipement / Drogues) avec override local par groupe.</p>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <option value="object">Objets</option>
            <option value="weapon">Armes</option>
            <option value="equipment">Équipement</option>
            <option value="drug">Drogues</option>
          </select>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Prix" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantité (0 autorisé)" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" />
          {category === 'weapon' ? <input value={weaponId} onChange={(e) => setWeaponId(e.target.value)} placeholder="Weapon ID / hash" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm" /> : null}
          {category === 'drug' ? (
            <select value={drugType} onChange={(e) => setDrugType(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <option value="drug">Coke/Meth/Weed</option>
              <option value="seed">Graine</option>
              <option value="planting">Plantation</option>
              <option value="pouch">Pochon</option>
              <option value="other">Autre</option>
            </select>
          ) : null}
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Colle une image ici (Ctrl+V)"
            onPaste={(e) => {
              const file = Array.from(e.clipboardData.items).map((x) => x.getAsFile()).find((f): f is File => !!f && f.type.startsWith('image/'))
              if (file) setImageFile(file)
            }}
            className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
          />
        </div>

        <button disabled={busy} onClick={() => void addItem()} className="mt-3 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold">
          {busy ? 'Ajout...' : 'Ajouter'}
        </button>
        {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <h2 className="text-lg font-semibold">Items {category}</h2>
        <div className="mt-3 space-y-2">
          {filtered.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-white/5">{it.image_url ? (<> {/* eslint-disable-next-line @next/next/no-img-element */}<img src={it.image_url} alt={it.name} className="h-full w-full object-cover" /></>) : null}</div>
                <p>{it.name} <span className="text-white/60">{Number(it.price || 0).toFixed(2)}$ • qté {it.default_quantity}</span></p>
              </div>
              <button onClick={() => void removeItem(it.id)} className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">Supprimer</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
