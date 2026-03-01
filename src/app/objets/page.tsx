import { Panel } from '@/components/ui/Panel'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'

const MOCK = [] as Array<{ id: string; name: string; price: number; imageUrl?: string; stock: number }>

export default function ObjetsPage() {
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

      <Panel>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <input
              placeholder="Rechercher un objet…"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm outline-none placeholder:text-white/40 focus:border-white/20"
            />
          </div>
          <div className="text-sm text-white/60">{MOCK.length} objet(s)</div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-12 bg-white/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/60">
            <div className="col-span-6">Objet</div>
            <div className="col-span-3">Prix</div>
            <div className="col-span-3 text-right">Stock</div>
          </div>

          {MOCK.length === 0 ? (
            <div className="p-6 text-sm text-white/60">
              Aucun objet pour le moment. Clique sur <span className="text-white">Ajouter</span>.
            </div>
          ) : (
            MOCK.map((it) => (
              <div key={it.id} className="grid grid-cols-12 border-t border-white/10 px-4 py-3 text-sm">
                <div className="col-span-6 flex items-center gap-3 font-medium">
                  <div className="h-9 w-9 rounded-lg border border-white/10 bg-white/[0.04]" />
                  <span>{it.name}</span>
                </div>
                <div className="col-span-3 text-white/70 tabular-nums">${it.price.toLocaleString('fr-FR')}</div>
                <div className="col-span-3 text-right tabular-nums">{it.stock}</div>
              </div>
            ))
          )}
        </div>

        <p className="mt-4 text-xs text-white/50">
          Note : là c’est une maquette UI. Quand tu seras prêt, on branchera Supabase (tables, RLS, seed) et on enlèvera les “MOCK”.
        </p>
      </Panel>
    </div>
  )
}
