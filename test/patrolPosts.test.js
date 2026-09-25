import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags } from 'discord.js';
import { parsePatrolCustomId } from '../src/patrolButtons.js';
import { validateDataPayload } from '../src/dataPayload.js';
import { applyEditMessage, applyPostMessage } from '../src/discordActions.js';

// interactionHandler pulls in config.js, which insists on these being set.
process.env.DISCORD_TOKEN ??= 'test-discord-token';
process.env.FORUMIFY_BASE_URL ??= 'https://forumify.test';
process.env.FORUMIFY_CLIENT_ID ??= 'test-client-id';
process.env.FORUMIFY_CLIENT_SECRET ??= 'test-client-secret';
process.env.BOT_PUBLIC_URL ??= 'https://bot.test';
process.env.BOT_SHARED_SECRET ??= 'test-shared-secret';

const { handleInteraction } = await import('../src/interactionHandler.js');

test('parses the patrol button custom ids', () => {
    assert.deepEqual(parsePatrolCustomId('patrol:join:12'), {
        action: 'join',
        id: '12',
        commandName: 'command-net-patrol-join',
    });
    assert.equal(parsePatrolCustomId('patrol:leave:12').commandName, 'command-net-patrol-leave');
    assert.equal(parsePatrolCustomId('patrol:aar:12').commandName, 'command-net-patrol-aar');
});

test('rejects custom ids that are not patrol buttons', () => {
    for (const bad of ['other:join:1', 'patrol:delete:1', 'patrol:join:abc', 'patrol:join', 'patrol:join:1:2', '']) {
        assert.equal(parsePatrolCustomId(bad), null, bad);
    }
});

function fakeInteraction(kind, extra = {}) {
    const calls = { deferReply: [], editReply: [], showModal: [] };
    return {
        calls,
        isButton: () => kind === 'button',
        isModalSubmit: () => kind === 'modal',
        isChatInputCommand: () => kind === 'slash',
        user: { id: 'u1' },
        guildId: 'g1',
        deferReply: async (o) => calls.deferReply.push(o),
        editReply: async (o) => calls.editReply.push(o),
        showModal: async (m) => calls.showModal.push(m),
        ...extra,
    };
}

test('a Join button runs the join command privately for the person who clicked', async () => {
    const ran = [];
    const interaction = fakeInteraction('button', { customId: 'patrol:join:12' });

    await handleInteraction(interaction, { runCommand: async (c) => (ran.push(c), { content: 'Joined.' }) });

    assert.deepEqual(interaction.calls.deferReply, [{ flags: MessageFlags.Ephemeral }]);
    assert.deepEqual(ran, [
        { name: 'command-net-patrol-join', options: { id: '12' }, discordUserId: 'u1', guildId: 'g1' },
    ]);
    assert.equal(interaction.calls.editReply[0].content, 'Joined.');
});

test('a Leave button runs the leave command', async () => {
    const ran = [];
    const interaction = fakeInteraction('button', { customId: 'patrol:leave:7' });

    await handleInteraction(interaction, { runCommand: async (c) => (ran.push(c), {}) });

    assert.equal(ran[0].name, 'command-net-patrol-leave');
    assert.equal(ran[0].options.id, '7');
});

test('buttons that are not patrol buttons are ignored', async () => {
    const interaction = fakeInteraction('button', { customId: 'something:else:1' });

    await handleInteraction(interaction, { runCommand: async () => assert.fail('should not run') });

    assert.equal(interaction.calls.deferReply.length, 0);
});

test('slash commands still reply publicly', async () => {
    const ran = [];
    const interaction = fakeInteraction('slash', {
        commandName: 'command-net-patrol-list',
        options: { data: [] },
    });

    await handleInteraction(interaction, { runCommand: async (c) => (ran.push(c), { content: 'List' }) });

    assert.deepEqual(interaction.calls.deferReply, [undefined]);
    assert.equal(ran[0].name, 'command-net-patrol-list');
});

test('validates EditMessage payloads', () => {
    const base = { type: 'EditMessage', guildId: '1', channelId: '2', messageId: '3' };

    assert.doesNotThrow(() => validateDataPayload({ ...base, content: 'x' }));
    // an empty components array is how buttons are removed, so it must count as present
    assert.doesNotThrow(() => validateDataPayload({ ...base, components: [] }));
    assert.throws(() => validateDataPayload({ ...base, messageId: undefined, content: 'x' }));
    assert.throws(() => validateDataPayload(base));
    assert.throws(() => validateDataPayload({ ...base, components: 'nope' }));
});

test('PostMessage components must be an array', () => {
    const base = { type: 'PostMessage', guildId: '1', channelId: '2', content: 'x' };

    assert.doesNotThrow(() => validateDataPayload({ ...base, components: [] }));
    assert.throws(() => validateDataPayload({ ...base, components: {} }));
});

function fakeClient(sent, edits) {
    const channel = {
        id: '2',
        isTextBased: () => true,
        send: async (body) => (sent.push(body), { id: 'm9' }),
        messages: { fetch: async (id) => ({ edit: async (changes) => edits.push({ id, changes }) }) },
    };
    return { channels: { fetch: async () => channel } };
}

test('posting a message reports where it landed and includes the buttons', async () => {
    const sent = [];
    const components = [{ type: 1, components: [] }];

    const result = await applyPostMessage(fakeClient(sent, []), {
        channelId: '2',
        embed: { title: 'Patrol' },
        components,
    });

    assert.deepEqual(result, { channelId: '2', messageId: 'm9' });
    assert.deepEqual(sent[0].components, components);
    assert.deepEqual(sent[0].embeds, [{ title: 'Patrol' }]);
});

test('editing changes only the parts that were sent', async () => {
    const edits = [];

    await applyEditMessage(fakeClient([], edits), { channelId: '2', messageId: 'm9', components: [] });

    assert.deepEqual(edits, [{ id: 'm9', changes: { components: [] } }]);
});
