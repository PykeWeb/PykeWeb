'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createWeapon } from '@/lib/weaponsApi'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Minus, Plus } from 'lucide-react'
import { ImageDropzone } from '@/components/modules/objets/ImageDropzone'

export function NewWeaponForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [weaponId, setWeaponId] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [saving, setSaving] = useState(false)

  const canSave = useMemo(() => {
    return !saving
  }, [saving])

  async function onSave() {
    setSaving(true)
    try {
      await createWeapon({
        name: name.trim() || undefined,
        weapon_id: weaponId.trim() || undefined,
        description: description.trim() || undefined,
        imageFile: file,
        quantity,
      })
      toast.success('Arme ajoutée')
      router.push('/armes')
    } catch (e: any) {
      toast.error(e?.message || "Impossible d'ajouter l'arme")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/60">Nom (optionnel)</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pistolet, AK-47, Glock..." />
          </div>

          <div>
            <label className="text-xs text-white/60">ID (optionnel)</label>
            <Input value={weaponId} onChange={(e) => setWeaponId(e.target.value)} placeholder="Ex: WEAPON_PISTOL, 12345..." />
            <p className="mt-1 text-xs text-white/50">Tu peux mettre l’ID FiveM / inventaire, ou un ID interne.</p>
          </div>

          <div>
            <label className="text-xs text-white/60">Quantité</label>
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <Input type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))} className="w-24" />
              <Button type="button" variant="secondary" onClick={() => setQuantity((q) => q + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/60">Image (optionnelle)</label>
            <ImageDropzone label="Image (optionnelle)" onChange={setFile} />
          </div>

          <div>
            <label className="text-xs text-white/60">Description (optionnelle)</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Infos utiles…" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs text-white/60">
          <p className="text-sm font-semibold text-white/80">Tips</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Tu peux coller une image (Ctrl+V) directement dans la zone.</li>
            <li>PNG/JPEG supportés (et WebP).</li>
            <li>L’image est upload dans Supabase Storage (bucket public).</li>
          </ul>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => router.back()} className="w-full">
              Annuler
            </Button>
            <Button onClick={onSave} disabled={!canSave} className="w-full">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
