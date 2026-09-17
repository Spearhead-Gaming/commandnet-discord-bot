import { config } from './config.js';

async function request(path, options = {}) {
    const res = await fetch(`${config.forumifyBaseUrl}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.forumifyApiToken}`,
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
