import { Panel } from '@/components/ui/Panel'
import { PageHeader } from '@/components/PageHeader'
import Link from 'next/link'

export default function NouveauObjetPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ajouter un objet"
        subtitle="Formulaire (UI only)"
        actions={
          <Link
            href="/objets"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium shadow-glow transition hover:bg-white/10"
          >
            Retour
          </Link>
        }
      />

      <Panel>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Nom</label>
            <input className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20" placeholder="Ex: Kit de crochetage" />
          </div>

          <div>
            <label className="text-sm text-white/70">Catégorie</label>
            <select className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20">
              <option>Objets</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-white/70">Stock initial</label>
            <input type="number" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20" placeholder="0" />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-white/70">Description (optionnel)</label>
            <textarea className="mt-2 min-h-[120px] w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-white/20" placeholder="Infos utiles…" />
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <button type="button" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium hover:bg-white/10">
              Annuler
            </button>
            <button type="button" className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold shadow-glow hover:bg-white/15">
              Enregistrer
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-white/50">
          Pour l’instant le bouton “Enregistrer” ne fait rien (pas de base branchée). On branche Supabase ensuite.
        </p>
      </Panel>
    </div>
  )
}
