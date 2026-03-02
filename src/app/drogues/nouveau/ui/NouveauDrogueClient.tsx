'use client'

import { Panel } from '@/components/ui/Panel'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { ImageDropzone } from '@/components/objets/ImageDropzone'
import { useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createDrugItem, type DrugKind } from '@/lib/drugsApi'

const KIND_LABEL: Record<DrugKind, string> = {
  drug: 'Drogue (pochons / items)',
  seed: 'Graine',
  planting: 'Plantation (pots, engrais, eau, lampes, etc.)',
  pouch: 'Pochons / vente (produit fini)',
  other: 'Autre / divers',
}

export default function NouveauDrogueClient() {
  const router = useRouter()
  const sp = useSearchParams()
  // Accept both ?type= and legacy ?kind= in the URL.
  const defaultType = ((sp.get('type') || sp.get('kind')) as DrugKind) || 'drug'

  const [type, setType] = useState<DrugKind>(defaultType)
  const [name, setName] = useState('')
  const [price, setPrice] = useState<string>('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = useMemo(() => name.trim().length > 0 && Number(price) >= 0 && Number.isInteger(quantity) && quantity >= 1 && !saving, [name, price, quantity, saving])
  const estimatedTotal = Number(price) >= 0 ? Number(price) * quantity : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ajouter un item (drogues)"
        subtitle="Nom • prix • image • description • type"
        actions={
          <Link
            href="/drogues"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium shadow-glow transition hover:bg-white/10"
          >
            Retour
          </Link>
        }
      />

      <Panel>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DrugKind)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20"
            >
              {Object.keys(KIND_LABEL).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k as DrugKind]}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Nom</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
              placeholder="Ex: Feuilles de coke / Graine coca / Lampe UV / Pochon coca…"
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Prix</label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/50">$</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-7 pr-3 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-white/70">Quantité</label>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10">
                <Minus className="h-4 w-4" />
              </button>
              <input type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))} className="w-24 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/20" />
              <button type="button" onClick={() => setQuantity((q) => q + 1)} className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {estimatedTotal !== null ? <p className="mt-2 text-xs text-white/50">Total estimé : {estimatedTotal.toFixed(2)} $</p> : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
            <p className="font-medium text-white">Tips</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-white/60">
              <li>Utilise “Graine / Supply / Lab” pour tout ce qui sert à produire.</li>
              <li>“Output” = ce que vous obtenez (feuilles, etc.).</li>
              <li>L’image peut être collée (Ctrl+V) ou upload (PNG/JPEG/WebP).</li>
            </ul>
          </div>

          <ImageDropzone label="Image (optionnelle)" onChange={setImageFile} />

          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Description (optionnelle)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 min-h-[120px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
              placeholder="Infos utiles…"
            />
          </div>

          {error ? (
            <div className="md:col-span-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              ❌ {error}
            </div>
          ) : null}

          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <Link
              href="/drogues"
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
                  await createDrugItem({
                    type,
                    name: name.trim(),
                    price: Number(price),
                    description: description.trim() || undefined,
                    imageFile,
                    quantity,
                  })
                  router.push('/drogues')
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
