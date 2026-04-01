import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { PrimaryButton, SecondaryButton } from '@/components/ui/design-system'

export default function AnnuairePage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Annuaire" subtitle="Choisis ton module : contacts ou dark chat." />
      <Panel className="flex flex-wrap gap-2">
        <Link href="/annuaire/contact"><PrimaryButton>Contacts</PrimaryButton></Link>
        <Link href="/annuaire/darkchat"><SecondaryButton>Dark Chat</SecondaryButton></Link>
      </Panel>
    </div>
  )
}
