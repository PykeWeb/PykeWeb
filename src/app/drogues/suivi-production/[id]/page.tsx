import EditSuiviProductionClient from '@/app/drogues/suivi-production/[id]/ui/EditSuiviProductionClient'

export default function EditSuiviProductionPage({ params }: { params: { id: string } }) {
  return <EditSuiviProductionClient id={params.id} />
}
