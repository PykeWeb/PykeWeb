/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { listObjects, type DbObject } from '@/lib/objectsApi'
import { listTransactions, type DbTransaction } from '@/lib/transactionsApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

type TabKey = 'catalogue' | 'transactions'

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-xl border px-3 py-2 text-sm font-medium transition ' +
        (active
          ? 'border-white/20 bg-white/10 text-white shadow-glow'
          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white')
      }
    >
      {children}
    </button>
  )
}

function TxBadge({ type }: { type: DbTransaction['type'] }) {
  const label = type === 'purchase' ? 'Achat' : 'Sortie'
  const Icon = type === 'purchase' ? ArrowDownRight : ArrowUpRight
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/80">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

export default function ObjetsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialTab = (searchParams.get('tab') as TabKey) || 'catalogue'
  const [tab, setTab] = useState<TabKey>(initialTab)

  const [items, setItems] = useState<DbObject[]>([])
  const [txs, setTxs] = useState<DbTransaction[]>([])
  const [loadingObjects, setLoadingObjects] = useState(true)
  const [loadingTx, setLoadingTx] = useState(true)
  const [q, setQ] = useState('')

  const added = searchParams.get('added') === '1'

  function setTabAndUrl(next: TabKey) {
    setTab(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', next)
    router.replace(`/objets?${params.toString()}`)
  }

  async function refreshObjects() {
    setLoadingObjects(true)
    try {
      const data = await listObjects()
      setItems(data)
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de charger les objets')
    } finally {
      setLoadingObjects(false)
    }
  }

  async function refreshTx() {
    setLoadingTx(true)
    try {
      const data = await listTransactions(50)
      setTxs(data)
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de charger les transactions')
    } finally {
      setLoadingTx(false)
    }
  }

  useEffect(() => {
    refreshObjects()
    refreshTx()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync tab when URL changes (back/forward)
  useEffect(() => {
    const next = ((searchParams.get('tab') as TabKey) || 'catalogue') as TabKey
    setTab(next)
  }, [searchParams])

  useEffect(() => {
    if (added) toast.success('Objet enregistré')
  }, [added])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return items
    return items.filter((it) => it.name.toLowerCase().includes(query))
  }, [items, q])

  const txToday = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    return txs.filter((t) => new Date(t.created_at).getTime() >= start).length
  }, [txs])

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Main */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <TabButton active={tab === 'catalogue'} onClick={() => setTabAndUrl('catalogue')}>
              Catalogue
            </TabButton>
            <TabButton active={tab === 'transactions'} onClick={() => setTabAndUrl('transactions')}>
              Transactions
            </TabButton>
          </div>

          <div className="flex items-center gap-2">
            {tab === 'transactions' ? (
              <>
                <Link href="/transactions/nouveau?type=purchase">
                  <Button>Nouvel achat</Button>
                </Link>
                <Link href="/transactions/nouveau?type=sale">
                  <Button variant="secondary">Nouvelle sortie</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/objets/nouveau">
                  <Button>Ajouter un objet</Button>
                </Link>
                <Link href="/objets?tab=transactions">
                  <Button variant="secondary">Transactions</Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {tab === 'catalogue' ? (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom)…" className="w-[280px]" />
                <span className="text-xs text-white/60">{filtered.length} objet(s)</span>
              </div>
              <div className="text-xs text-white/50">Astuce : utilise “Achat” pour entrer du stock et “Sortie” pour retirer.</div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.04] text-white/70">
                  <tr>
                    <th className="px-4 py-3">Objet</th>
                    <th className="px-4 py-3">Prix</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingObjects ? (
                    <tr>
                      <td className="px-4 py-6 text-white/60" colSpan={4}>
                        Chargement…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-white/60" colSpan={4}>
                        Aucun objet pour le moment.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((it) => (
                      <tr key={it.id} className="border-t border-white/10">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                              {it.image_url ? (
                                <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full bg-gradient-to-br from-white/10 to-white/[0.02]" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold">{it.name}</p>
                              {it.description ? <p className="text-xs text-white/60 line-clamp-1">{it.description}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/80 tabular-nums">{Number(it.price).toFixed(2)} $</td>
                        <td className="px-4 py-3 font-semibold">{it.stock}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Link href="/transactions/nouveau?type=purchase">
                              <Button variant="secondary">Achat</Button>
                            </Link>
                            <Link href="/transactions/nouveau?type=sale">
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
          </>
        ) : (
          <>
            <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.04] text-white/70">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Interlocuteur</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTx ? (
                    <tr>
                      <td className="px-4 py-6 text-white/60" colSpan={4}>
                        Chargement…
                      </td>
                    </tr>
                  ) : txs.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-white/60" colSpan={4}>
                        Aucune transaction pour le moment.
                      </td>
                    </tr>
                  ) : (
                    txs.map((t) => (
                      <tr key={t.id} className="border-t border-white/10 hover:bg-white/5">
                        <td className="px-4 py-3">
                          <TxBadge type={t.type} />
                        </td>
                        <td className="px-4 py-3 text-white/80">{new Date(t.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 text-white/80">{t.counterparty ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-white/90">{t.total == null ? '—' : `${Number(t.total).toFixed(2)} $`}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-white/50">Tip : “Achat” = entrée stock, “Sortie” = retrait stock (vente / perte / transfert).</p>
          </>
        )}
      </div>

      {/* Right rail */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-glow">
        <p className="text-sm font-semibold">Raccourcis</p>

        <div className="mt-3 grid gap-2">
          <Link href="/objets/nouveau">
            <Button className="w-full">Ajouter un objet</Button>
          </Link>
          <Link href="/transactions/nouveau?type=purchase">
            <Button variant="secondary" className="w-full">
              Nouvel achat
            </Button>
          </Link>
          <Link href="/transactions/nouveau?type=sale">
            <Button variant="secondary" className="w-full">
              Nouvelle sortie
            </Button>
          </Link>
        </div>

        {/* Mini carré / widget transactions */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/60">Transactions</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{txToday}</p>
              <p className="text-xs text-white/50">aujourd’hui</p>
            </div>
            <div className="flex gap-2">
              <Link href="/objets?tab=transactions">
                <Button variant="ghost">Voir</Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/60">
          <p className="font-semibold text-white/80">Mode RP</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Achat : tu ajoutes au stock + le total te dit combien payer</li>
            <li>Sortie : tu retires du stock (vente / perte / transfert)</li>
            <li>Historique : utile pour justifier qui a pris quoi et quand</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
