import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { StatCard } from '@/components/dashboard/StatCard'
import { Panel } from '@/components/ui/Panel'
import { Activity, Box, ClipboardList, Plus } from 'lucide-react'
import Link from 'next/link'

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Objets dans le catalogue" value="0" icon={<Box className="h-5 w-5" />} />
        <StatCard title="Mouvements enregistrés" value="0" icon={<Activity className="h-5 w-5" />} />
        <StatCard
          title="À faire"
          value="Renseigner vos objets"
          icon={<ClipboardList className="h-5 w-5" />}
          variant="accent"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">Derniers mouvements</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/60">bientôt</span>
              </div>
              <p className="mt-1 text-sm text-white/60">Historique (à brancher plus tard sur Supabase).</p>
            </div>
            <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">Voir</span>
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-sm text-white/60">
            Aucun mouvement pour le moment.
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">Quick actions</p>
              <p className="mt-1 text-sm text-white/60">Raccourcis utiles</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <Link
              href="/objets"
              className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 shadow-glow transition hover:bg-white/10"
            >
              <span className="font-medium">Gérer les objets</span>
              <span className="text-white/60 transition group-hover:text-white">→</span>
            </Link>

            <Link
              href="/objets/nouveau"
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 shadow-glow transition hover:bg-white/10"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
                <Plus className="h-4 w-4" />
              </span>
              <div>
                <p className="font-medium">Ajouter un objet</p>
                <p className="text-xs text-white/60">Crée une entrée dans le catalogue</p>
              </div>
            </Link>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
              Mode multi-groupe / remboursements / prêts : on branchera ça plus tard.
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
