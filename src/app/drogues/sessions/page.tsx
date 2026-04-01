'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { SecondaryButton } from '@/components/ui/design-system'
import CokeClosePage from '@/app/coke/cloturer/page'
import MethClosePage from '@/app/meth/cloturer/page'

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
        {mode === 'coke' ? <CokeClosePage /> : <MethClosePage />}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/drogues/benefice">
            <SecondaryButton>Bénéfice drogue</SecondaryButton>
          </Link>
          <Link href="/drogues/suivi-production">
            <SecondaryButton>Transfo groupes</SecondaryButton>
          </Link>
        </div>
      </Panel>
    </div>
  )
}
