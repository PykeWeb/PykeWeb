import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return

  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['\"]|['\"]$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

loadDotEnv()

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export const env = {
  token: required('DISCORD_BOT_TOKEN'),
  clientId: required('DISCORD_CLIENT_ID'),
  guildId: required('DISCORD_GUILD_ID'),
  targetGroupId: required('DISCORD_TARGET_GROUP_ID'),
  apiBaseUrl: required('DISCORD_API_BASE_URL').replace(/\/$/, ''),
  sharedSecret: required('DISCORD_SHARED_SECRET'),
  registerCommands: (process.env.DISCORD_REGISTER_COMMANDS || 'true').toLowerCase() === 'true',
}
