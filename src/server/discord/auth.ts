import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

function readSignature(request: Request) {
  return request.headers.get('x-discord-shared-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
}

export function assertDiscordApiAuth(request: Request) {
  const configuredSecret = process.env.DISCORD_BACKEND_SHARED_SECRET?.trim()
  if (!configuredSecret) {
    throw new Error('DISCORD_BACKEND_SHARED_SECRET est manquant côté serveur.')
  }

  const provided = readSignature(request).trim()
  if (!provided) {
    return NextResponse.json({ error: 'Signature Discord manquante.' }, { status: 401 })
  }

  const expectedBuffer = Buffer.from(configuredSecret)
  const providedBuffer = Buffer.from(provided)

  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    return NextResponse.json({ error: 'Signature Discord invalide.' }, { status: 403 })
  }

  return null
}
