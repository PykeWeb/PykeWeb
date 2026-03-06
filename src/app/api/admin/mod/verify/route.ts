import { NextResponse } from 'next/server'
import { isValidAdminCredentials } from '@/server/auth/adminRequest'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; password?: string }
    const username = (body.username || '').trim()
    const password = (body.password || '').trim()

    if (!username || !password) {
      return NextResponse.json({ error: 'Identifiants requis' }, { status: 400 })
    }

    const ok = await isValidAdminCredentials(username, password)
    if (!ok) return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Payload invalide' }, { status: 400 })
  }
}
