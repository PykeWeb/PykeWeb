# Bot Discord ↔ Pyke Stock

## Architecture minimale

- `bot-discord/` : app Node.js séparée (discord.js), découplée du front Next.js.
- `src/app/api/discord/*` : API privée serveur (Next.js) consommée uniquement par le bot.
- `group_members` : enrichie pour supporter le provisioning Discord (`discord_user_id`, `rp_phone_number`, `password_hash`, `is_active`).

Flux:
1. `guildMemberAdd` envoie un bouton / commande `/enregistrer`.
2. `interactionCreate` ouvre un modal `Prénom RP + Numéro RP`.
3. Soumission modal => `POST /api/discord/create-member`.
4. Backend crée (ou réactive) le membre, hash le mot de passe, renvoie identifiants temporaires.
5. Bot renomme le membre Discord + envoie identifiants en MP.
6. `guildMemberRemove` => `POST /api/discord/deactivate-member` (désactivation, pas suppression hard).

## Sécurité

- Secret partagé (`DISCORD_SHARED_SECRET` côté bot, `DISCORD_BACKEND_SHARED_SECRET` côté Next.js).
- Vérification en comparaison constante (`timingSafeEqual`).
- Aucun secret côté front.
- Mot de passe en clair envoyé uniquement en DM, hashé en base (`password_hash`).

## Variables d'environnement

### Côté Next.js (`.env.local`)

```bash
DISCORD_BACKEND_SHARED_SECRET=change_me_super_secret
```

### Côté bot (`bot-discord/.env`)

Copier `bot-discord/.env.example` puis renseigner:

```bash
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DISCORD_TARGET_GROUP_ID=
DISCORD_API_BASE_URL=http://localhost:3000
DISCORD_SHARED_SECRET=change_me_super_secret
DISCORD_REGISTER_COMMANDS=true
```

## Installation

1. Appliquer la migration Supabase `supabase/migrations/20260327_discord_member_provisioning.sql`.
2. Démarrer le site Next.js.
3. Installer et lancer le bot:

```bash
cd bot-discord
npm install
npm run dev
```

## Permissions Discord requises

- View Channels
- Send Messages
- Use Application Commands
- Manage Nicknames
- Read Message History
- Send Messages in DM

Le bot log explicitement les erreurs de rename/DM/API pour faciliter le diagnostic.
