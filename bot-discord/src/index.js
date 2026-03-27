import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js'
import { env } from './config/env.js'
import * as guildMemberAdd from './events/guildMemberAdd.js'
import * as guildMemberRemove from './events/guildMemberRemove.js'
import * as interactionCreate from './events/interactionCreate.js'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
})

async function registerCommands() {
  if (!env.registerCommands) return

  const commands = [
    new SlashCommandBuilder()
      .setName('enregistrer')
      .setDescription('Ouvre le formulaire de création de compte tablette')
      .toJSON(),
  ]

  const rest = new REST({ version: '10' }).setToken(env.token)
  await rest.put(Routes.applicationGuildCommands(env.clientId, env.guildId), { body: commands })
  console.info('[startup] slash command /enregistrer enregistrée')
}

client.once('ready', () => {
  console.info(`[startup] Bot connecté en tant que ${client.user?.tag}`)
})

client.on(guildMemberAdd.name, guildMemberAdd.execute)
client.on(guildMemberRemove.name, guildMemberRemove.execute)
client.on(interactionCreate.name, interactionCreate.execute)

await registerCommands()
await client.login(env.token)
