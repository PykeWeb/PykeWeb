import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

export const name = 'guildMemberAdd'

export async function execute(member) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`start-onboarding:${member.guild.id}`)
      .setLabel('Créer mon compte tablette')
      .setStyle(ButtonStyle.Primary),
  )

  const message = [
    `Bienvenue ${member.user}.`,
    'Clique sur le bouton ci-dessous pour remplir ton formulaire RP (prénom + numéro).',
  ].join('\n')

  try {
    await member.send({ content: message, components: [row] })
    console.info(`[guildMemberAdd] DM onboarding envoyé à ${member.user.tag}`)
    return
  } catch (error) {
    console.warn(`[guildMemberAdd] DM impossible pour ${member.user.tag}:`, error)
  }

  const fallbackChannel = member.guild.systemChannel
  if (fallbackChannel && fallbackChannel.isTextBased()) {
    await fallbackChannel.send(`${member.user} active tes MP puis utilise /enregistrer pour finaliser ton onboarding.`)
  }
}
