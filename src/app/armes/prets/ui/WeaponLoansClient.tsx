'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { closeWeaponLoan, listActiveWeaponLoans } from '@/lib/weaponsApi'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'

export function WeaponLoansClient() {
  const [loading, setLoading] = useState(true)
  const [loans, setLoans] = useState<any[]>([])

  async function refresh() {
    setLoading(true)
    try {
      const data = await listActiveWeaponLoans()
      setLoans(data)
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de charger les prêts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function onClose(id: string) {
    try {
      await closeWeaponLoan({ loanId: id })
      toast.success('Prêt terminé (arme rendue)')
      await refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de terminer le prêt')
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/70">{loading ? 'Chargement…' : `${loans.length} prêt(s) en cours`}</p>
        <div className="flex items-center gap-2">
          <Link href="/armes">
            <Button variant="secondary">Retour</Button>
          </Link>
          <Link href="/armes/prets/nouveau">
            <Button>Créer un prêt</Button>
          </Link>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-white/70">
            <tr>
              <th className="px-4 py-3">Arme</th>
              <th className="px-4 py-3">Emprunteur</th>
              <th className="px-4 py-3">Qté</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-white/60" colSpan={5}>
                  Chargement…
                </td>
              </tr>
            ) : loans.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-white/60" colSpan={5}>
                  Aucun prêt en cours.
                </td>
              </tr>
            ) : (
              loans.map((l) => (
                <tr key={l.id} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                        {l.weapons?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.weapons.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-white/10 to-white/[0.02]" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{l.weapons?.name || 'Sans nom'}</p>
                        <p className="text-xs text-white/60">{l.weapons?.weapon_id || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{l.borrower_name}</td>
                  <td className="px-4 py-3 font-semibold">{l.quantity}</td>
                  <td className="px-4 py-3 text-white/70">{new Date(l.loaned_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Button onClick={() => onClose(l.id)} variant="secondary">
                      Terminer
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-white/50">“Terminer” remet automatiquement la quantité prêtée dans le stock.</p>
    </div>
  )
}
