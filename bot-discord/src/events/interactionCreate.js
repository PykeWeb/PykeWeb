import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js'
import { createMemberFromDiscord } from '../services/memberProvisioning.js'

const MODAL_ID_PREFIX = 'onboarding-modal'

function buildOnboardingModal(guildId) {
  const modal = new ModalBuilder()
    .setCustomId(`${MODAL_ID_PREFIX}:${guildId}`)
    .setTitle('Formulaire membre tablette')

  const firstNameInput = new TextInputBuilder()
    .setCustomId('rp_first_name')
    .setLabel('Prénom RP')
    .setRequired(true)
    .setMaxLength(32)
    .setStyle(TextInputStyle.Short)

  const phoneInput = new TextInputBuilder()
    .setCustomId('rp_phone_number')
    .setLabel('Numéro RP')
    .setRequired(true)
    .setMaxLength(20)
    .setStyle(TextInputStyle.Short)

  modal.addComponents(
    new ActionRowBuilder().addComponents(firstNameInput),
    new ActionRowBuilder().addComponents(phoneInput),
  )

  return modal
}

export const name = 'interactionCreate'

export async function execute(interaction) {
  if (interaction.isChatInputCommand() && interaction.commandName === 'enregistrer') {
    const modal = buildOnboardingModal(interaction.guildId)
    await interaction.showModal(modal)
    return
  }

  if (interaction.isButton() && interaction.customId.startsWith('start-onboarding:')) {
    const [, guildId] = interaction.customId.split(':')
    const modal = buildOnboardingModal(guildId || interaction.guildId)
    await interaction.showModal(modal)
    return
  }

  if (!interaction.isModalSubmit() || !interaction.customId.startsWith(MODAL_ID_PREFIX)) return

  const rpFirstName = interaction.fields.getTextInputValue('rp_first_name')
  const rpPhoneNumber = interaction.fields.getTextInputValue('rp_phone_number')

  if (!interaction.guildId) {
    await interaction.reply({ content: 'Le formulaire doit être validé depuis le serveur.', ephemeral: true })
    return
  }

  await interaction.deferReply({ ephemeral: true })

  try {
    const guild = interaction.guild ?? (await interaction.client.guilds.fetch(interaction.guildId))
    const member = interaction.member ?? (await guild.members.fetch(interaction.user.id))

    const result = await createMemberFromDiscord(member, { rpFirstName, rpPhoneNumber })

    const infos = [
      `✅ Compte tablette créé pour **${result.created.rp_first_name}**.`,
      `Identifiant: **${result.created.username}**`,
      result.rename.ok ? 'Pseudo Discord mis à jour.' : `⚠️ Rename impossible: ${result.rename.error}`,
      result.dm.ok ? 'Identifiants envoyés en MP.' : `⚠️ MP impossible: ${result.dm.error}`,
    ]

    await interaction.editReply({ content: infos.join('\n') })
  } catch (error) {
    console.error('[interactionCreate] provisioning error', error)
    const message = error instanceof Error ? error.message : 'Erreur interne.'
    await interaction.editReply({ content: `❌ ${message}` })
  }
}
