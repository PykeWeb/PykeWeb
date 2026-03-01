'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { createWeaponLoan, listWeapons, type DbWeapon } from '@/lib/weaponsApi'

export function NewWeaponLoanForm() {
  const router = useRouter()
  const params = useSearchParams()
  const preselect = params.get('weapon') || ''

  const [weapons, setWeapons] = useState<DbWeapon[]>([])
  const [weaponId, setWeaponId] = useState(preselect)
  const [borrower, setBorrower] = useState('')
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
    if (!borrower.trim()) return false
    if (quantity <= 0) return false
    if (selected && selected.stock < quantity) return false
    return !saving
  }, [weaponId, borrower, quantity, saving, selected])

  async function onSave() {
    setSaving(true)
    try {
      await createWeaponLoan({
        weaponId,
        borrowerName: borrower.trim(),
        quantity,
        note: note.trim() || undefined,
      })
      toast.success('Prêt créé')
      router.push('/armes/prets')
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de créer le prêt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-white/60">Nouveau prêt d’arme</p>
        <Link href="/armes/prets">
          <Button variant="secondary">Retour</Button>
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/60">Arme</label>
            <select
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 outline-none"
              value={weaponId}
              onChange={(e) => setWeaponId(e.target.value)}
            >
              {weapons.map((w) => (
                <option key={w.id} value={w.id}>
                  {(w.name || 'Sans nom') + (w.weapon_id ? ` • ${w.weapon_id}` : '')} • stock: {w.stock}
                </option>
              ))}
            </select>
            {selected ? <p className="mt-1 text-xs text-white/50">Stock dispo: {selected.stock}</p> : null}
          </div>

          <div>
            <label className="text-xs text-white/60">Nom du membre</label>
            <Input value={borrower} onChange={(e) => setBorrower(e.target.value)} placeholder="Ex: Alex, Pyke, etc." />
          </div>

          <div>
            <label className="text-xs text-white/60">Quantité</label>
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
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contexte, sortie, etc." />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs text-white/60">
          <p className="text-sm font-semibold text-white/80">Rappel</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Le prêt retire la quantité du stock.</li>
            <li>Terminer le prêt remet la quantité au stock.</li>
            <li>Tu retrouves tous les prêts en cours sur la page “Prêts”.</li>
          </ul>

          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => router.back()} className="w-full">
              Annuler
            </Button>
            <Button onClick={onSave} disabled={!canSave} className="w-full">
              {saving ? 'Création…' : 'Valider'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
