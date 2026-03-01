import './globals.css'
import type { Metadata } from 'next'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="grain">
        <div className="min-h-screen bg-[radial-gradient(1200px_700px_at_20%_-10%,rgba(120,119,198,0.28),transparent_60%),radial-gradient(1200px_700px_at_80%_0%,rgba(59,130,246,0.22),transparent_55%),radial-gradient(1000px_700px_at_60%_110%,rgba(168,85,247,0.16),transparent_55%)]">
          <div className="mx-auto flex min-h-screen w-full max-w-[1480px] gap-6 px-4 py-6">
            <Sidebar />
            <main className="flex min-w-0 flex-1 flex-col gap-6">
              <Topbar />
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
