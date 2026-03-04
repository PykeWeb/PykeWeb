'use client'

import { NouvelleDepenseForm } from '@/components/ui/NouvelleDepenseForm'

export default function NouvelleDepensePage() {
  return <NouvelleDepenseForm backHref="/depenses" successHref="/depenses" title="Nouvelle dépense" />
}
