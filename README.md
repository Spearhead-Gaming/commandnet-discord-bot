# commandnet-discord-bot

**The multi-guild Discord bot for the Command Net forumify plugin suite.**

![Node.js](https://img.shields.io/badge/node-%3E%3D18.17-339933?logo=node.js&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-%5E14.16.3-5865F2?logo=discord&logoColor=white)
![Express](https://img.shields.io/badge/express-%5E4.19.2-000000?logo=express&logoColor=white)

## Table of Contents

- [Overview](#overview)
- [🧩 Why One Bot, Many Guilds](#-why-one-bot-many-guilds)
- [🔌 Contract](#-contract)
  - [forumify → bot](#forumify--bot)
  - [bot → forumify](#bot--forumify)
- [⚠️ Known Gap](#️-known-gap)
- [🚀 Running](#-running)
- [🧪 Testing](#-testing)
- [Related](#related)

## Overview

Multi-guild Discord bot for the Command Net forumify plugin suite (`commandnet-plugin`,
`milsim-id-card-plugin`, and future plugins like a server manager and S3 tools). One bot
process, invited into the community server plus every unit's private server, replacing
forumify's single-guild hosted bot.

## 🧩 Why One Bot, Many Guilds

Discord bots are natively multi-guild: one application token, one gateway connection, every
event and interaction carries a `guild_id`. This bot threads that `guild_id` through every
call instead of assuming a single server, so it doesn't need to run per unit.

## 🔌 Contract

### forumify → bot

This bot's HTTP API. Every request requires `Authorization: Bearer $BOT_SHARED_SECRET`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/ready` | Health check |
| `POST` | `/data` | Push a change (see payload shapes below) |
| `GET` | `/data?type=roles&guildId=X` | List a guild's roles, for forumify's role-mapping UI |
| `GET` | `/data?type=guildMembers&guildId=X` | List a guild's human members, for forumify's Discord member import |

**`POST /data` payload shapes** — the body is one of:

**`RolesChanged`**
```json
{
  "type": "RolesChanged",
  "guildId": "...",
  "discordUserId": "...",
  "rolesAdded": ["snowflake"],
  "rolesRemoved": ["snowflake"]
}
```

**`UsernameChanged`**
```json
{
  "type": "UsernameChanged",
  "guildId": "...",
  "discordUserId": "...",
  "newUsername": "..."
}
```

**`PostMessage`**
```json
{
  "type": "PostMessage",
  "guildId": "...",
  "channelId": "...",
  "content": "...",
  "embed": {},
  "components": []
}
```
Answers `200 { channelId, messageId }` (`CreateInvite` and `DirectMessage` also answer with
data; every other type answers `204`), so forumify can edit the message later. `components`
is a list of Discord action rows in Discord's own JSON format.

**`CreateInvite`**
```json
{
  "type": "CreateInvite",
  "guildId": "...",
  "channelId": "...",
  "maxAgeSeconds": 604800,
  "maxUses": 1,
  "reason": "..."
}
```
Creates an invite to that channel's server, single-use and 7 days by default
(`maxAgeSeconds` 604800, `maxUses` 1), and answers `200 { code, url }`. The bot needs the
**Create Invite** permission in that channel, so pick the channel accordingly.

**`DirectMessage`**
```json
{
  "type": "DirectMessage",
  "guildId": "...",
  "discordUserId": "...",
  "content": "...",
  "embed": {}
}
```
DMs a user. Never fails the request for an undeliverable DM: it answers `200 { ok: true }` or
`200 { ok: false, reason }` with `reason` one of `dms_closed`, `unknown_user`, `failed`. The
user must share a server with the bot.

**`EditMessage`**
```json
{
  "type": "EditMessage",
  "guildId": "...",
  "channelId": "...",
  "messageId": "...",
  "content": "...",
  "embed": {},
  "components": []
}
```
Changes only the parts sent; `components: []` removes the buttons.

**`GET /data?type=guildMembers&guildId=X` response**

Returns `[{ id, username, displayName }]` (bots left out). Uses the Server Members intent
the bot already requests.

### bot → forumify

Auth is OAuth2 client credentials, not a static token: the bot exchanges
`FORUMIFY_CLIENT_ID`/`FORUMIFY_CLIENT_SECRET` for a JWT via `POST /oauth/token`
(`grant_type=client_credentials`), caches it, and refreshes it before it expires (forumify
issues these with a 1 hour lifetime). Every call below sends that JWT as
`Authorization: Bearer <token>`.

All three live under forumify's `/api` prefix (API Platform's routing config puts every
`ApiResource` there, unlike the plain Symfony controllers behind `/oauth/token` and the admin
pages) — it's easy to miss since neither this plugin's own code nor its docs mention it.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/discord/register-bot` | `{ endpoint, token }` — announces this bot's public URL and the token forumify should send back to it, on every `ready` |
| `GET` | `/api/discord/commands` | Fetches the slash command definitions forumify wants registered |
| `POST` | `/api/discord/commands/run` | `{ name, options, discordUserId, guildId }` — forwards a slash command interaction, returns `{ content?, embeds? }` to reply with |

## ⚠️ Known Gap

This is the bot half only. The forumify-side plugin (a fork of
[`forumify-discord-plugin`](https://github.com/forumify/forumify-discord-plugin)) doesn't yet
send/accept `guildId` on these routes — today's installed plugin assumes one server. The PHP
fork (adding a `DiscordConnection` entity per guild, threading `guildId` through `BotService`,
and exposing `/discord/commands` + `/discord/commands/run`) is a separate, follow-up piece of
work this bot is built to interoperate with once it lands.

## 🚀 Running

For production (Docker / Portainer), see [INSTALL.md](INSTALL.md).

Locally:

```bash
npm install
cp .env.example .env   # fill in DISCORD_TOKEN, FORUMIFY_BASE_URL, etc.
npm start
```

## 🧪 Testing

```bash
npm test
```

## Related

Part of the Command Net suite:

- [commandnet-plugin](https://github.com/Spearhead-Gaming/commandnet-plugin) — the Forumify plugin this bot receives role/user data from
- [commandnet-discord-plugin](https://github.com/Spearhead-Gaming/commandnet-discord-plugin) — the Forumify plugin this bot talks to over HTTP
- `commandnet-s3-plugin` — Operations-staff tooling, optionally posts Discord announcements via this bot
- `command-net-theme` — the Forumify theme for the community
- `milsim-id-card-plugin` — fictional MILSIM personnel ID cards
