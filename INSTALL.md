# Installing commandnet-discord-bot (Docker + Portainer)

This guide takes you from nothing to a running bot container on your web server, managed through
Portainer. It takes about 20 minutes.

What you'll end up with:

```
Discord  <── gateway (outbound, no port needed) ──  bot container  ── HTTPS ──>  forumify
                                                         ▲
forumify ──── HTTPS (bot.your-domain) ──> reverse proxy ─┘  port 4100
```

The bot connects out to Discord, so Discord doesn't need an open port. forumify does need to
reach the bot's HTTP API on port 4100 (`/data` and `/ready`) at the URL you set as `BOT_PUBLIC_URL`.

---

## 1. Create the Discord application

1. Go to <https://discord.com/developers/applications> and click **New Application**. Name it
   (e.g. "Command Net").
2. **Bot** tab:
   - Click **Reset Token** and copy the token. This is `DISCORD_TOKEN`. Keep it secret.
   - Under **Privileged Gateway Intents**, turn on **Server Members Intent**. The bot won't
     start without it, because it asks for the `GuildMembers` intent.
3. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: **Manage Roles**, **Manage Nicknames**, **View Channels**,
     **Send Messages**, **Embed Links**, **Create Instant Invite** (for single-use invites DMed to transferred members)
   - Open the generated URL and invite the bot to the community server, then to **every unit
     server**. It's one bot for all of them.
4. In each server, go to **Server Settings → Roles** and drag the bot's role **above** every role
   it should assign. Discord won't let a bot manage a role that sits above its own, or change the
   nickname of anyone whose top role is higher than the bot's.

## 2. Prepare forumify

The bot works with the **commandnet-discord-plugin** installed in your forumify instance. You need:

- `FORUMIFY_BASE_URL`: your forumify site root, e.g. `https://spearheadgaming.example.com`
  (no trailing slash).
- `FORUMIFY_CLIENT_ID` / `FORUMIFY_CLIENT_SECRET`: OAuth client credentials the bot exchanges for
  a short-lived access token on every call to forumify. Go to forumify's
  **Admin → Discord Plugin Settings**; if the bot isn't registered yet, forumify auto-creates an
  OAuth client called `forumify-discord-bot` and shows you its `client_id` and `client_secret`
  right there on the page. Copy both.

## 3. Choose your secrets and URL

- `BOT_SHARED_SECRET`: a long random string. Generate one with:

  ```bash
  openssl rand -hex 32
  ```

  You don't need to type it into forumify. The bot sends it to forumify on every startup
  (`/discord/register-bot`), and forumify uses it from then on.
- `BOT_PUBLIC_URL`: the address forumify will use to reach the bot, e.g.
  `https://bot.your-domain.com`. See step 5.

## 4. Deploy the stack in Portainer

The repo includes a `Dockerfile` and a `docker-compose.yml`, so Portainer can build the image
straight from GitHub.

1. Portainer → your environment → **Stacks** → **Add stack**.
2. Name: `commandnet-discord-bot`.
3. Build method: **Repository**.
   - Repository URL: `https://github.com/Spearhead-Gaming/commandnet-discord-bot`
   - Repository reference: `refs/heads/master`
   - Compose path: `docker-compose.yml`
   - If the repo is private, turn on **Authentication**. Enter your GitHub username and a
     [personal access token](https://github.com/settings/tokens) with read access to the repo.
   - Optional: turn on **GitOps updates** (polling) so pushes to `master` redeploy automatically.
4. **Environment variables**: add each of these:

   | Name                 | Example                                  |
   |----------------------|------------------------------------------|
   | `DISCORD_TOKEN`         | *(from step 1)*                          |
   | `FORUMIFY_BASE_URL`     | `https://spearheadgaming.example.com`    |
   | `FORUMIFY_CLIENT_ID`    | *(from step 2)*                          |
   | `FORUMIFY_CLIENT_SECRET`| *(from step 2)*                          |
   | `BOT_PUBLIC_URL`        | `https://bot.your-domain.com`            |
   | `BOT_SHARED_SECRET`  | *(from step 3)*                          |
   | `BOT_HOST_PORT`      | `4100` *(optional: host port to publish)* |

   Tip: **Advanced mode** lets you paste them all at once in `.env` format.
5. Click **Deploy the stack**.

### Updating later

Go to Stacks → `commandnet-discord-bot` → **Pull and redeploy**, and tick **Re-pull image and
redeploy**. Or skip this if you turned on GitOps polling.

## 5. Make the bot reachable from forumify

forumify has to be able to call `BOT_PUBLIC_URL`. Pick whichever matches your setup:

- **Reverse proxy (recommended)**: point a subdomain like `bot.your-domain.com` at
  `http://<server>:4100` in Nginx Proxy Manager, Traefik, Caddy, or plain nginx, with HTTPS
  turned on. Set `BOT_PUBLIC_URL=https://bot.your-domain.com`.
- **forumify runs in Docker on the same host**: put both containers on a shared Docker network
  and set `BOT_PUBLIC_URL=http://commandnet-discord-bot:4100`. You won't need to publish a port
  or set up a proxy.
- **Plain IP (testing only)**: `BOT_PUBLIC_URL=http://<server-ip>:4100`. The shared secret would
  cross the network unencrypted, so don't leave it like this.

If you're using a firewall and a reverse proxy, don't open port 4100 to the internet. Only the
proxy needs to reach it.

## 6. Verify

1. Portainer → **Containers** → `commandnet-discord-bot` → **Logs**. You should see:

   ```
   HTTP API listening on :4100
   Logged in as Command Net#1234, in N guild(s).
   ```

   You should **not** see `Bot registration failed` or `Command registration failed` after that.
2. The container's status should change to **healthy** within about a minute. The healthcheck
   calls `/ready`, which returns 200 only once the bot is connected to Discord.
3. Check it from outside, through your proxy:

   ```bash
   curl -i -H "Authorization: Bearer YOUR_SHARED_SECRET" https://bot.your-domain.com/ready
   ```

   `200` means it's working. `401` means the secret doesn't match. `503` means the bot isn't
   connected to Discord yet.
4. In Discord, type `/` in any server the bot is in. The commands defined in forumify should
   show up. Global commands can take a few minutes to appear the first time.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Container keeps restarting, logs show `TokenInvalid` | Wrong `DISCORD_TOKEN`. Reset it in the dev portal and update the stack env. |
| `Used disallowed intents` | Turn on **Server Members Intent** (step 1.2). |
| `Missing required env var X` | That variable is blank in the stack's env. |
| `Bot registration failed: ...` | The bot can't reach `FORUMIFY_BASE_URL`, or `FORUMIFY_CLIENT_ID`/`FORUMIFY_CLIENT_SECRET` are wrong. Test from the host: `docker exec commandnet-discord-bot wget -qO- $FORUMIFY_BASE_URL`. |
| `Forumify OAuth token request failed: 400 ...` | `FORUMIFY_CLIENT_ID`/`FORUMIFY_CLIENT_SECRET` don't match forumify's records. Re-copy them from Admin → Discord Plugin Settings - the secret is only shown there. |
| Roles/nicknames don't change | The bot's role is too low in that server (step 1.4), or it's missing Manage Roles / Manage Nicknames. The logs show `Failed to add role ...`. |
| forumify can't reach the bot | Check `BOT_PUBLIC_URL`, the proxy, and the firewall. Run the curl from step 6.3 **from the forumify server**. |
| Container stays `unhealthy` | The bot isn't connected to Discord. Check the logs for the reason. |

## Running without Portainer

Same files, plain Docker Compose:

```bash
git clone https://github.com/Spearhead-Gaming/commandnet-discord-bot.git
cd commandnet-discord-bot
cp .env.example .env   # fill it in
docker compose up -d --build
```
