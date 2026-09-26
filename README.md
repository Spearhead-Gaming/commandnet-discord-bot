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
  - `{ type: 'PostMessage', guildId, channelId, content?, embed?, components? }` - answers `200 { channelId, messageId }` (`CreateInvite` and `DirectMessage` also answer with data; every other type answers `204`), so forumify can edit the message later. `components` is a list of Discord action rows in Discord's own JSON format.
  - `{ type: 'CreateInvite', guildId, channelId, maxAgeSeconds?, maxUses?, reason? }` - creates an invite to that channel's server, single-use and 7 days by default (`maxAgeSeconds` 604800, `maxUses` 1), and answers `200 { code, url }`. The bot needs the **Create Invite** permission in that channel, so pick the channel accordingly.
  - `{ type: 'DirectMessage', guildId, discordUserId, content?, embed? }` - DMs a user. Never fails the request for an undeliverable DM: it answers `200 { ok: true }` or `200 { ok: false, reason }` with `reason` one of `dms_closed`, `unknown_user`, `failed`. The user must share a server with the bot.
  - `{ type: 'EditMessage', guildId, channelId, messageId, content?, embed?, components? }` - changes only the parts sent; `components: []` removes the buttons.
  - `{ type: 'DeleteMessage', guildId, channelId, messageId }` - deletes a message the bot posted. A message that is already gone counts as deleted.
- `GET /data?type=roles&guildId=X` - list that guild's roles, for forumify's role-mapping UI.
- `GET /data?type=guildMembers&guildId=X` - list that guild's human members (`[{ id, username, displayName }]`, bots left out), for forumify's Discord member import. Uses the Server Members intent the bot already requests.

### bot -> forumify

Auth is OAuth2 client credentials, not a static token: the bot exchanges
`FORUMIFY_CLIENT_ID`/`FORUMIFY_CLIENT_SECRET` for a JWT via `POST /oauth/token`
(`grant_type=client_credentials`), caches it, and refreshes it before it expires (forumify
issues these with a 1 hour lifetime). Every call below sends that JWT as
`Authorization: Bearer <token>`.

All three live under forumify's `/api` prefix (API Platform's routing config puts every
`ApiResource` there, unlike the plain Symfony controllers behind `/oauth/token` and the admin
pages) - it's easy to miss since neither this plugin's own code nor its docs mention it.

- `POST /api/discord/register-bot` `{ endpoint, token }` - announces this bot's public URL and
  the token forumify should send back to it, on every `ready`.
- `GET /api/discord/commands` - fetches the slash command definitions forumify wants registered.
- `POST /api/discord/commands/run` `{ name, options, discordUserId, guildId }` - forwards a
  slash command interaction, returns `{ content?, embeds? }` to reply with.

## Known gap

This is the bot half only. The forumify-side plugin (a fork of
[`forumify-discord-plugin`](https://github.com/forumify/forumify-discord-plugin)) doesn't yet
send/accept `guildId` on these routes - today's installed plugin assumes one server. The PHP
fork (adding a `DiscordConnection` entity per guild, threading `guildId` through `BotService`,
and exposing `/discord/commands` + `/discord/commands/run`) is a separate, follow-up piece of
work this bot is built to interoperate with once it lands.

## Running

For production (Docker / Portainer), see [INSTALL.md](INSTALL.md). Locally:

```bash
npm install
cp .env.example .env   # fill in DISCORD_TOKEN, FORUMIFY_BASE_URL, etc.
npm start
```

## Testing

```bash
npm test
```
