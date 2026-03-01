/* eslint-disable @next/next/no-img-element */
'use client'

import { Panel } from '@/components/ui/Panel'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { ImageDropzone } from '@/components/objets/ImageDropzone'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createObject } from '@/lib/objectsApi'

export default function NouveauObjetPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [price, setPrice] = useState<string>('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = useMemo(() => name.trim().length > 0 && Number(price) >= 0 && !saving, [name, price, saving])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ajouter un objet"
        subtitle="Nom • prix • image (upload / coller)"
      />

      <Panel>
        <div className="flex justify-end">
          <Link
            href="/objets"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium shadow-glow transition hover:bg-white/10"
          >
            Retour
          </Link>
        </div>

        <div className="h-2" />

        <form className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Nom</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
              placeholder="Ex: Kit de crochetage"
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
            <p className="mt-2 text-xs text-white/50">Le symbole est juste visuel. On adaptera au système RP (cash, item, etc.).</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
            <p className="font-medium text-white">Tips</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-white/60">
              <li>Tu peux coller une image directement (Ctrl+V) dans la zone image.</li>
              <li>PNG/JPEG supportés (et WebP).</li>
              <li>L’image sera upload dans Supabase Storage (bucket public).</li>
            </ul>
          </div>

          <ImageDropzone label="Image (optionnelle)" onChange={setImageFile} />

          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Description (optionnel)</label>
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
            <button type="button" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium hover:bg-white/10">
              Annuler
            </button>
            <button
              type="button"
              disabled={!canSave}
              className={
                'rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold shadow-glow transition ' +
                (canSave ? 'bg-white/10 hover:bg-white/15' : 'cursor-not-allowed bg-white/[0.04] text-white/40')
              }
              onClick={async () => {
                if (!canSave) return
                try {
                  setSaving(true)
                  setError(null)
                  await createObject({
                    name: name.trim(),
                    price: Number(price),
                    description: description.trim() || undefined,
                    imageFile,
                  })
                  router.push('/objets?added=1')
                } catch (e: any) {
                  setError(e?.message || 'Erreur Supabase (création objet)')
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  )
}
