import { postPrivateApi } from './apiClient.js'
import { resolveGroupIdForGuild } from '../config/guildMapping.js'

function clean(value) {
  return String(value || '').trim()
}

function isDigits(value) {
  return /^[0-9]{2,20}$/.test(value)
}

function validateModalPayload({ rpFirstName, rpPhoneNumber }) {
  if (!rpFirstName) throw new Error('Le prénom RP est requis.')
  if (!rpPhoneNumber) throw new Error('Le numéro RP est requis.')
  if (rpFirstName.length < 2 || rpFirstName.length > 32) throw new Error('Le prénom RP doit contenir entre 2 et 32 caractères.')
  if (!isDigits(rpPhoneNumber)) throw new Error('Le numéro RP doit contenir uniquement des chiffres (2 à 20).')
}

async function safeRename(member, nick) {
  try {
    await member.setNickname(nick, 'Onboarding RP validé')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Rename impossible' }
  }
}

async function safeDm(member, message) {
  try {
    await member.send(message)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'DM impossible' }
  }
}

export async function createMemberFromDiscord(member, { rpFirstName, rpPhoneNumber }) {
  const groupId = resolveGroupIdForGuild(member.guild.id)
  if (!groupId) throw new Error(`Aucun mapping groupe configuré pour guild ${member.guild.id}`)

  const payload = {
    group_id: groupId,
    rp_first_name: clean(rpFirstName),
    rp_phone_number: clean(rpPhoneNumber),
    discord_user_id: member.id,
    discord_username: member.user.tag,
  }

  validateModalPayload(payload)

  const created = await postPrivateApi('/api/discord/create-member', payload)
  const rename = await safeRename(member, created.rp_first_name)
  const dm = await safeDm(
    member,
    [
      'Bienvenue. Ton compte tablette a été créé.',
      `Identifiant : ${created.username}`,
      `Mot de passe : ${created.password}`,
      'Pense à changer ton mot de passe via un admin si besoin.',
    ].join('\n'),
  )

  return {
    created,
    rename,
    dm,
  }
}

export async function deactivateMemberFromDiscord(member) {
  const groupId = resolveGroupIdForGuild(member.guild.id)
  if (!groupId) return { ok: true, skipped: true, reason: 'NO_MAPPING' }

  const payload = {
    group_id: groupId,
    discord_user_id: member.id,
    reason: 'DISCORD_MEMBER_REMOVE',
  }

  const response = await postPrivateApi('/api/discord/deactivate-member', payload)
  return { ok: true, response }
}
