import { config } from './config.js';

// forumify's /oauth/token issues client-credentials JWTs that expire after 1 hour
// (see commandnet-discord-plugin's ClientCredentials grant handler). We cache the
// token and refresh it a bit early rather than re-authenticating on every call.
const REFRESH_MARGIN_MS = 60_000;
let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken() {
    if (cachedToken && Date.now() < cachedTokenExpiresAt) {
        return cachedToken;
    }

    const res = await fetch(`${config.forumifyBaseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: config.forumifyClientId,
            client_secret: config.forumifyClientSecret,
        }),
    });

    if (!res.ok) {
        throw new Error(`Forumify OAuth token request failed: ${res.status} ${await res.text()}`);
    }

    const { access_token: accessToken, expires_in: expiresIn } = await res.json();
    cachedToken = accessToken;
    cachedTokenExpiresAt = Date.now() + expiresIn * 1000 - REFRESH_MARGIN_MS;
    return cachedToken;
}

async function request(path, options = {}) {
    const token = await getAccessToken();
    const res = await fetch(`${config.forumifyBaseUrl}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            // Without this, API Platform's GetCollection returns its default JSON-LD/Hydra
            // shape ({ "hydra:member": [...] }), not the plain array callers expect.
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    });

    if (!res.ok) {
        throw new Error(`Forumify API ${path} failed: ${res.status} ${await res.text()}`);
    }

    return res.status === 204 ? null : res.json();
}

/**
 * Tells forumify where and how to reach this bot's own HTTP API.
 */
export function registerBot() {
    return request('/api/discord/register-bot', {
        method: 'POST',
        body: JSON.stringify({ endpoint: config.publicUrl, token: config.sharedSecret }),
    });
}

export async function fetchCommandDefinitions() {
    const data = await request('/api/discord/commands');
    // forumify always answers with a JSON-LD/Hydra collection ({ member: [...] }), even
    // when asked for plain JSON - the Accept header above is apparently a no-op here.
    return Array.isArray(data) ? data : (data.member ?? data['hydra:member'] ?? []);
}

export function runCommand({ name, options, discordUserId, guildId }) {
    return request('/api/discord/commands/run', {
        method: 'POST',
        body: JSON.stringify({ name, options, discordUserId, guildId }),
    });
}
