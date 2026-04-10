import Link from 'next/link'
import { BarChart3, Factory, FlaskConical, HandCoins, ShoppingBag } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'

const cards = [
  { href: '/drogues/sessions', title: 'Sessions', description: 'Sessions partenaires et suivi des opérations actives.', icon: FlaskConical, tone: 'from-fuchsia-500/25 to-violet-600/15 border-fuchsia-300/35' },
  { href: '/drogues/benefice', title: 'Bénéfice', description: 'Calculs de marge, coûts transfo et gains estimés.', icon: BarChart3, tone: 'from-emerald-500/25 to-teal-600/15 border-emerald-300/35' },
  { href: '/drogues/suivi-production', title: 'Transfo groupes', description: 'Demandes, quantités reçues, argent reçu et validation finale.', icon: Factory, tone: 'from-cyan-500/25 to-blue-600/15 border-cyan-300/35' },
  { href: '/drogues/vente', title: 'Vente', description: 'Enregistrer les sorties et la valeur réellement vendue.', icon: ShoppingBag, tone: 'from-amber-500/25 to-orange-600/15 border-amber-300/35' },
]

export default function DroguesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Accueil Drogues" subtitle="Hub rapide et lisible pour piloter le module drogues dans FiveM." />
      <Panel className="border-white/12 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center gap-2 text-sm text-emerald-100/85">
          <HandCoins className="h-4 w-4" />
          Flux optimisé tablette: accès direct aux 4 actions clés.
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <Link key={card.href} href={card.href} className={`group rounded-2xl border bg-gradient-to-br p-4 transition hover:scale-[1.01] ${card.tone}`}>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-base font-semibold text-white">{card.title}</h2>
                </div>
                <p className="mt-2 text-sm text-white/75">{card.description}</p>
              </Link>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
