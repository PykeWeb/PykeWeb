'use client'

import { SbEntreeSortieClient } from '@/components/modules/sb/SbEntreeSortieClient'
export default function FinanceAchatVentePage() {
  return <SbEntreeSortieClient />
            counterparty: payload.counterparty,
            notes: payload.notes,
          })
          toast.success(copy.finance.toastSaved)
          router.push('/finance')
          router.refresh()
        }}
      />
    </div>
  )
}
