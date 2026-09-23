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
    return request('/discord/register-bot', {
        method: 'POST',
        body: JSON.stringify({ endpoint: config.publicUrl, token: config.sharedSecret }),
    });
}

export function fetchCommandDefinitions() {
    return request('/discord/commands');
}

export function runCommand({ name, options, discordUserId, guildId }) {
    return request('/discord/commands/run', {
        method: 'POST',
        body: JSON.stringify({ name, options, discordUserId, guildId }),
    });
}
