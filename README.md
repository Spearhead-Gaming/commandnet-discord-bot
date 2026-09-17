# commandnet-discord-bot

Multi-guild Discord bot for the Command Net forumify plugin suite (commandnet-plugin,
forumify-id-card-plugin, and future plugins like a server manager and S3 tools). One bot
process, invited into the community server plus every unit's private server, replacing
forumify's single-guild hosted bot.

## Why one bot, many guilds

Discord bots are natively multi-guild: one application token, one gateway connection, every
event and interaction carries a `guild_id`. This bot threads that `guild_id` through every
call instead of assuming a single server, so it doesn't need to run per unit.

## Contract

### forumify -> bot (this bot's HTTP API, `Authorization: Bearer $BOT_SHARED_SECRET`)

- `GET /ready` - health check.
- `POST /data` - push a change. Body is one of:
  - `{ type: 'RolesChanged', guildId, discordUserId, rolesAdded: [snowflake], rolesRemoved: [snowflake] }`
  - `{ type: 'UsernameChanged', guildId, discordUserId, newUsername }`
  - `{ type: 'PostMessage', guildId, channelId, content?, embed? }`
- `GET /data?type=roles&guildId=X` - list that guild's roles, for forumify's role-mapping UI.

### bot -> forumify (`Authorization: Bearer $FORUMIFY_API_TOKEN`)

- `POST /discord/register-bot` `{ endpoint, token }` - announces this bot's public URL and
  the token forumify should send back to it, on every `ready`.
- `GET /discord/commands` - fetches the slash command definitions forumify wants registered.
- `POST /discord/commands/run` `{ name, options, discordUserId, guildId }` - forwards a slash
  command interaction, returns `{ content?, embeds? }` to reply with.

## Known gap

This is the bot half only. The forumify-side plugin (a fork of
[`forumify-discord-plugin`](https://github.com/forumify/forumify-discord-plugin)) doesn't yet
send/accept `guildId` on these routes - today's installed plugin assumes one server. The PHP
fork (adding a `DiscordConnection` entity per guild, threading `guildId` through `BotService`,
and exposing `/discord/commands` + `/discord/commands/run`) is a separate, follow-up piece of
work this bot is built to interoperate with once it lands.

## Running

```bash
npm install
cp .env.example .env   # fill in DISCORD_TOKEN, FORUMIFY_BASE_URL, etc.
npm start
```

## Testing

```bash
npm test
```
