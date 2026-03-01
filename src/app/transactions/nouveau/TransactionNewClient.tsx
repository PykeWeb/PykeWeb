'use client'

import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import TransactionBuilder from '@/components/transactions/TransactionBuilder'
import type { TxType } from '@/lib/transactionsApi'

export default function TransactionNewClient({ type }: { type: TxType }) {
  const title = useMemo(() => (type === 'purchase' ? 'Nouvel achat' : 'Nouvelle sortie'), [type])
  const subtitle = useMemo(
    () =>
      type === 'purchase'
        ? "Sélectionne les objets + quantités. Le total se calcule automatiquement."
        : "Sélectionne les objets + quantités à retirer du stock (vente / transfert).",
    [type]
  )

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Link
            href="/transactions"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 shadow-glow hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        }
      />

      <Panel>
        <TransactionBuilder type={type} />
      </Panel>
    </>
  )
}
