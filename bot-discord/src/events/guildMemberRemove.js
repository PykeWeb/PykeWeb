import { deactivateMemberFromDiscord } from '../services/memberProvisioning.js'

export const name = 'guildMemberRemove'

export async function execute(member) {
  try {
    const result = await deactivateMemberFromDiscord(member)
    console.info(`[guildMemberRemove] ${member.user.tag}`, result)
  } catch (error) {
    console.error(`[guildMemberRemove] failed for ${member.user.tag}`, error)
  }
}
