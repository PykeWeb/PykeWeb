import { env } from './env.js'

const mapping = new Map([[env.guildId, env.targetGroupId]])

export function resolveGroupIdForGuild(guildId) {
  return mapping.get(guildId) || null
}
