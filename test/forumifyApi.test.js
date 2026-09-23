import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DISCORD_TOKEN ??= 'test-discord-token';
process.env.FORUMIFY_BASE_URL ??= 'https://forumify.test';
process.env.FORUMIFY_CLIENT_ID ??= 'test-client-id';
process.env.FORUMIFY_CLIENT_SECRET ??= 'test-client-secret';
process.env.BOT_PUBLIC_URL ??= 'https://bot.test';
process.env.BOT_SHARED_SECRET ??= 'test-shared-secret';

const { registerBot, fetchCommandDefinitions } = await import('../src/forumifyApi.js');

function mockFetch(responses) {
    let call = 0;
    global.fetch = async (url, options) => {
        const response = responses[Math.min(call, responses.length - 1)];
        call += 1;
        return {
            ok: true,
            status: 200,
            json: async () => response,
            text: async () => JSON.stringify(response),
        };
    };
    return () => call;
}

test('fetches an OAuth token before calling the API, and reuses it', async () => {
    const callCount = mockFetch([{ access_token: 'jwt-1', expires_in: 3600 }]);

    await registerBot();
    assert.equal(callCount(), 2, 'expected one /oauth/token call plus one /discord/register-bot call');

    await registerBot();
    assert.equal(callCount(), 3, 'the cached token should be reused, so only one more call (register-bot) is made');
});

test('unwraps a Hydra/JSON-LD collection into a plain array of command definitions', async () => {
    // The previous test already cached a still-valid token, so this call reuses it and
    // hits only the /api/discord/commands endpoint - one mocked response is enough.
    mockFetch([
        { '@context': '/api/contexts/DiscordCommand', '@type': 'Collection', totalItems: 1, member: [{ name: 'forum-profile' }] },
    ]);

    const definitions = await fetchCommandDefinitions();
    assert.deepEqual(definitions, [{ name: 'forum-profile' }]);
});
