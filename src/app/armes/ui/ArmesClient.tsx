'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { listWeapons, adjustWeaponStock, updateWeapon, deleteWeapon, type DbWeapon } from '@/lib/weaponsApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

export function ArmesClient() {
  const [items, setItems] = useState<DbWeapon[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

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



  async function quickEdit(item: DbWeapon) {
    const nextName = window.prompt("Nom de l'arme :", item.name || '')
    if (nextName === null) return
    const nextWeaponId = window.prompt('ID arme (optionnel) :', item.weapon_id || '')
    if (nextWeaponId === null) return
    const nextDescription = window.prompt('Description (optionnel) :', item.description || '')
    if (nextDescription === null) return

    try {
      await updateWeapon({
        id: item.id,
        name: nextName.trim() || null,
        weapon_id: nextWeaponId.trim() || null,
        description: nextDescription.trim() || null,
      })
      await refresh()
      toast.success('Arme modifiée')
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de modifier')
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
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom ou ID)..." className="w-[280px]" />
            <span className="text-xs text-white/60">{filtered.length} arme(s)</span>
          </div>
        </div>

        {/* Actions (dans la bulle principale, pas en haut à droite) */}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link href="/armes/nouveau" className="block">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
              <p className="text-sm font-semibold">Ajouter une arme</p>
              <p className="mt-1 text-xs text-white/60">Catalogue armes</p>
            </div>
          </Link>
          <Link href="/armes/prets" className="block">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
              <p className="text-sm font-semibold">Prêts en cours</p>
              <p className="mt-1 text-xs text-white/60">Voir / gérer les prêts</p>
            </div>
          </Link>
          <Link href="/armes/prets/nouveau" className="block">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
              <p className="text-sm font-semibold">Créer un prêt</p>
              <p className="mt-1 text-xs text-white/60">Nouveau prêt d’arme</p>
            </div>
          </Link>
        </div>

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
                        <Button variant="ghost" onClick={() => bump(w.id, -1)} disabled={w.stock <= 0}>
                          −
                        </Button>
                        <Button variant="ghost" onClick={() => bump(w.id, +1)}>
                          +
                        </Button>
                        <Link href={`/armes/prets/nouveau?weapon=${w.id}`}>
                          <Button variant="secondary">Prêter</Button>
                        </Link>
                        <Button variant="secondary" onClick={() => quickEdit(w)}>Modifier</Button>
                        <Button variant="secondary" onClick={() => removeItem(w)}>Supprimer</Button>
                        <Link href={`/armes/sortie?weapon=${w.id}`}>
                          <Button variant="secondary">Sortie</Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-white/50">
          Astuce : <span className="text-white/70">+</span> quand vous récupérez une arme, <span className="text-white/70">−</span> quand une arme est perdue/vendue. Pour un prêt, utilisez “Prêter”.
        </p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs text-white/60">
          <p className="font-semibold text-white/80">Mode RP</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Le stock des armes se gère en unités (1, 2, 3…)</li>
            <li>Prêt = l’arme sort du stock, retour = elle revient</li>
            <li>“Sortie” = vente / perte / transfert (retire du stock)</li>
          </ul>
        </div>

      </div>


    </div>
  )
}
