import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCreateInvite, applyDirectMessage, toMemberSummaries } from '../src/discordActions.js';

const member = (id, username, displayName, bot = false) => ({ id, displayName, user: { username, bot } });

test('summarises human members with only the fields the import needs', () => {
    const members = new Map([
        ['1', member('1', 'doe', 'Cpl Doe')],
        ['2', member('2', 'roe', 'Roe')],
    ]);

    assert.deepEqual(toMemberSummaries(members), [
        { id: '1', username: 'doe', displayName: 'Cpl Doe' },
        { id: '2', username: 'roe', displayName: 'Roe' },
    ]);
});

test('leaves bots out', () => {
    const members = new Map([
        ['1', member('1', 'doe', 'Doe')],
        ['2', member('2', 'somebot', 'Some Bot', true)],
    ]);

    assert.deepEqual(toMemberSummaries(members).map((m) => m.id), ['1']);
});

test('an empty guild gives an empty list', () => {
    assert.deepEqual(toMemberSummaries(new Map()), []);
});

test('CreateInvite makes a single-use 7-day invite by default and returns its code and url', async () => {
    let options;
    const client = {
        channels: {
            fetch: async () => ({ createInvite: async (o) => ((options = o), { code: 'abc', url: 'https://discord.gg/abc' }) }),
        },
    };

    assert.deepEqual(await applyCreateInvite(client, { channelId: '1' }), { code: 'abc', url: 'https://discord.gg/abc' });
    assert.equal(options.maxAge, 604800);
    assert.equal(options.maxUses, 1);
});

test('CreateInvite honours explicit limits and rejects a channel that cannot hold invites', async () => {
    let options;
    const client = { channels: { fetch: async () => ({ createInvite: async (o) => ((options = o), { code: 'c', url: 'u' }) }) } };
    await applyCreateInvite(client, { channelId: '1', maxAgeSeconds: 60, maxUses: 5, reason: 'r' });
    assert.deepEqual([options.maxAge, options.maxUses, options.reason], [60, 5, 'r']);

    await assert.rejects(applyCreateInvite({ channels: { fetch: async () => ({}) } }, { channelId: '1' }));
});

const clientWithUser = (send) => ({ users: { fetch: async () => ({ send }) } });

test('DirectMessage sends and reports ok', async () => {
    let sent;
    const result = await applyDirectMessage(clientWithUser(async (m) => (sent = m)), { discordUserId: '1', content: 'hi' });
    assert.deepEqual(result, { ok: true });
    assert.equal(sent.content, 'hi');
});

test('DirectMessage reports closed DMs instead of throwing', async () => {
    const closed = Object.assign(new Error('Cannot send messages to this user'), { code: 50007 });
    const result = await applyDirectMessage(clientWithUser(async () => { throw closed; }), { discordUserId: '1', content: 'hi' });
    assert.deepEqual(result, { ok: false, reason: 'dms_closed' });
});

test('DirectMessage reports an unknown user and any other failure', async () => {
    const unknown = { users: { fetch: async () => { throw Object.assign(new Error('Unknown User'), { code: 10013 }); } } };
    assert.deepEqual(await applyDirectMessage(unknown, { discordUserId: '1', content: 'x' }), { ok: false, reason: 'unknown_user' });
    assert.deepEqual(
        await applyDirectMessage(clientWithUser(async () => { throw new Error('boom'); }), { discordUserId: '1', content: 'x' }),
        { ok: false, reason: 'failed' },
    );
});
