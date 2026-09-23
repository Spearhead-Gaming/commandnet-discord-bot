# commandnet-discord-bot

The Node.js/discord.js Discord bot half of the Command Net suite for **Spearhead Gaming**.
One bot process, one Discord application, invited into the community server plus every unit's
private server — multi-guild is native to how Discord bots work (one gateway connection, every
event/interaction carries a `guild_id`), so this bot threads `guild_id` through every call
instead of assuming a single server. See [README.md](README.md) for the full HTTP contract in
both directions.

Built for this one community, not a general-purpose skeleton.

## The ecosystem

Sibling repos (PHP, `G:\Github Repos`): **commandnet-plugin**, **commandnet-s3-plugin**,
**command-net-theme**, **forumify-id-card-plugin**. The one this bot actually talks to is
**commandnet-discord-plugin** — a Forumify plugin, *not* a Discord library — over the HTTP
contract in the README (forumify → bot: `/data`, `/ready`; bot → forumify:
`/discord/register-bot`, `/discord/commands`, `/discord/commands/run`).

This repo's own README's "Known gap" section (says the PHP side "doesn't yet" support
`guildId`/multi-guild) is **stale** — check `commandnet-discord-plugin`'s actual code/README
before trusting that note; its `DiscordConnection` entity already exists.

## Stack

Plain Node.js (`type: module`, ESM), `discord.js` for the gateway, `express` for the small
HTTP server that implements both directions of the contract, `dotenv` for config. No
TypeScript, no build step, no framework beyond Express.

```
src/
  index.js              entry point
  config.js              env/config loading
  discordActions.js       role/username/message actions against the Discord API
  interactionHandler.js    slash command interaction dispatch
  interactionOptions.js     option parsing (string options only today - see Gotchas)
  commands.js              slash command registration
  httpServer.js             the Express server (both HTTP directions)
  forumifyApi.js            outbound calls to the PHP plugin
  dataPayload.js             payload shaping for /data pushes
```

## Running

```bash
npm install
cp .env.example .env   # DISCORD_TOKEN, FORUMIFY_BASE_URL, BOT_SHARED_SECRET, etc.
npm start                # node src/index.js
npm test                  # node --test
```

For it to do anything useful, `commandnet-discord-plugin` (in the Forumify dev app) needs to
be running and configured with this bot's shared secret, and this bot needs `FORUMIFY_BASE_URL`
pointing at that app (e.g. the WSL/Docker dev stack's address, not `localhost` from inside a
container — check current networking before assuming which host/port is reachable).

## Gotchas learned the hard way

- **Slash commands only support string options today** (`interactionOptions.js`) — no typed
  numbers/booleans/users/dates, no subcommands, no buttons/modals, replies are always public,
  no DMs. A Patrol-support spec written for the wider ecosystem explicitly deferred typed
  options/buttons/private replies to a "bot upgrade" phase for this reason — check for that
  spec or a related branch before assuming richer interactions are already possible.
- Every command handler needs to resolve the calling Discord user to a Forumify member itself
  (via `forumifyApi.js`) — there's no shared permission/identity layer here, each command does
  its own check.
