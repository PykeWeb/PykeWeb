import { PageHeader } from '@/components/PageHeader'
import FinanceClient from './ui/FinanceClient'

export default function FinancePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Finance" />
      <FinanceClient />
    </div>
  )
}
