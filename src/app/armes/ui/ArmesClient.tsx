'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { listWeapons, adjustWeaponStock, type DbWeapon } from '@/lib/weaponsApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'

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
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom ou ID)..." className="w-[280px]" />
            <span className="text-xs text-white/60">{filtered.length} arme(s)</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/armes/nouveau">
              <Button>Ajouter une arme</Button>
            </Link>
            <Link href="/armes/prets">
              <Button variant="secondary">Prêts en cours</Button>
            </Link>
          </div>
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
