'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CokePrepareRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/coke/cloturer')
  }, [router])

  return null
}
