'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'

export default function DroguesSessionsPage() {
  const [mode, setMode] = useState<'coke' | 'meth'>('coke')

  return (
    <div className="space-y-4">
      <PageHeader title="Sessions" subtitle="Choisis ta session: Coke ou Meth" />
      <Panel>
        <div className="mb-4 inline-flex rounded-xl border border-white/15 bg-white/[0.04] p-1">
          <button type="button" onClick={() => setMode('coke')} className={`rounded-lg px-3 py-1.5 text-sm ${mode === 'coke' ? 'bg-cyan-500/25 text-cyan-50' : 'text-white/75'}`}>Coke</button>
          <button type="button" onClick={() => setMode('meth')} className={`rounded-lg px-3 py-1.5 text-sm ${mode === 'meth' ? 'bg-violet-500/25 text-violet-50' : 'text-white/75'}`}>Meth</button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-lg font-semibold">{mode === 'coke' ? 'Session coke' : 'Session meth'}</p>
          <p className="mt-1 text-sm text-white/70">{mode === 'coke' ? 'Prépare, suis et clôture une session de plantation.' : 'Prépare, suis et clôture une session meth avec les équipements.'}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={mode === 'coke' ? '/coke/cloturer' : '/meth/cloturer'}>
              <PrimaryButton>{mode === 'coke' ? 'Ouvrir Session Coke' : 'Ouvrir Session Meth'}</PrimaryButton>
            </Link>
            <Link href="/drogues/benefice">
              <SecondaryButton>Bénéfice drogue</SecondaryButton>
            </Link>
            <Link href="/drogues/suivi-production">
              <SecondaryButton>Transfo groupes</SecondaryButton>
            </Link>
          </div>
        </div>
      </Panel>
    </div>
  )
}
