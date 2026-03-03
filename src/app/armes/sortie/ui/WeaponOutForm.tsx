'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { adjustWeaponStock, listWeapons, type DbWeapon } from '@/lib/weaponsApi'
import { GlassSelect } from '@/components/ui/GlassSelect'

export function WeaponOutForm() {
  const router = useRouter()
  const params = useSearchParams()
  const preselect = params.get('weapon') || ''

  const [weapons, setWeapons] = useState<DbWeapon[]>([])
  const [weaponId, setWeaponId] = useState(preselect)
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await listWeapons()
        setWeapons(data)
        if (!weaponId && data[0]) setWeaponId(data[0].id)
      } catch (e: any) {
        toast.error(e?.message || 'Impossible de charger les armes')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = useMemo(() => weapons.find((w) => w.id === weaponId), [weapons, weaponId])

  const canSave = useMemo(() => {
    if (!weaponId) return false
    if (quantity <= 0) return false
    if (selected && selected.stock < quantity) return false
    return !saving
  }, [weaponId, quantity, saving, selected])

  async function onSave() {
    setSaving(true)
    try {
      await adjustWeaponStock({ weaponId, delta: -Math.abs(quantity), note: note.trim() || 'Sortie' })
      toast.success('Sortie enregistrée')
      router.push('/armes')
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de faire la sortie')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/60">Arme</label>
            <GlassSelect
              className="mt-1"
              value={weaponId}
              onChange={setWeaponId}
              options={weapons.map((w) => ({ value: w.id, label: `${(w.name || 'Sans nom') + (w.weapon_id ? ` • ${w.weapon_id}` : '')} • stock: ${w.stock}` }))}
            />
            {selected ? <p className="mt-1 text-xs text-white/50">Stock dispo: {selected.stock}</p> : null}
          </div>

          <div>
            <label className="text-xs text-white/60">Quantité à retirer</label>
            <Input
              value={String(quantity)}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))}
              type="number"
              min={1}
            />
            {selected && selected.stock < quantity ? <p className="mt-1 text-xs text-red-300">Stock insuffisant</p> : null}
          </div>

          <div>
            <label className="text-xs text-white/60">Note (optionnel)</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Vendu à X, perdu en sortie, transféré…" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs text-white/60">
          <p className="text-sm font-semibold text-white/80">Info</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Une sortie diminue le stock.</li>
            <li>Utilise la note pour retrouver pourquoi.</li>
            <li>Historique stock dispo plus tard via “Mouvements”.</li>
          </ul>

          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => router.back()} className="w-full">
              Annuler
            </Button>
            <Button onClick={onSave} disabled={!canSave} className="w-full">
              {saving ? 'Enregistrement…' : 'Valider'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
