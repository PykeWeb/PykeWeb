/* eslint-disable @next/next/no-img-element */
'use client'

import { Panel } from '@/components/ui/Panel'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { listObjects, type DbObject } from '@/lib/objectsApi'

export default function ObjetsPage() {
  const [items, setItems] = useState<DbObject[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const added = searchParams.get('added') === '1'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await listObjects()
        if (!cancelled) setItems(data)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur chargement Supabase')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return items
    return items.filter((it) => it.name.toLowerCase().includes(query))
  }, [items, q])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Objets"
        subtitle="Catalogue + stock (version simple)"
        actions={
          <Link
            href="/objets/nouveau"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium shadow-glow transition hover:bg-white/10"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </Link>
        }
      />

      {added ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          ✅ Objet enregistré.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          ❌ {error}
          <div className="mt-1 text-xs text-rose-100/80">
            Vérifie tes variables Vercel / .env.local et que la table <span className="font-semibold">objects</span> existe.
          </div>
        </div>
      ) : null}

      <Panel>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un objet…"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
            />
          </div>
          <div className="text-sm text-white/60">{filtered.length} objet(s)</div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-12 bg-white/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/60">
            <div className="col-span-6">Objet</div>
            <div className="col-span-3">Prix</div>
            <div className="col-span-3 text-right">Stock</div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-white/60">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-white/60">
              Aucun objet pour le moment. Clique sur <span className="text-white">Ajouter</span>.
            </div>
          ) : (
            filtered.map((it) => (
              <div key={it.id} className="grid grid-cols-12 border-t border-white/10 px-4 py-3 text-sm">
                <div className="col-span-6 flex items-center gap-3 font-medium">
                  {it.image_url ? (
                    <img
                      src={it.image_url}
                      alt={it.name}
                      className="h-9 w-9 rounded-lg border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-lg border border-white/10 bg-white/[0.04]" />
                  )}
                  <span className="truncate">{it.name}</span>
                </div>
                <div className="col-span-3 text-white/70 tabular-nums">${it.price.toLocaleString('fr-FR')}</div>
                <div className="col-span-3 text-right tabular-nums">{it.stock}</div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  )
}
