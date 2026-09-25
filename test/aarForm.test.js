import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags } from 'discord.js';
import { buildAarImagesModal, buildAarModal, parsePatrolCustomId } from '../src/patrolButtons.js';
import { DRAFT_TTL_MS, deleteDraft, getDraft, saveDraft } from '../src/aarDrafts.js';

// interactionHandler pulls in config.js, which insists on these being set.
process.env.DISCORD_TOKEN ??= 'test-discord-token';
process.env.FORUMIFY_BASE_URL ??= 'https://forumify.test';
process.env.FORUMIFY_CLIENT_ID ??= 'test-client-id';
process.env.FORUMIFY_CLIENT_SECRET ??= 'test-client-secret';
process.env.BOT_PUBLIC_URL ??= 'https://bot.test';
process.env.BOT_SHARED_SECRET ??= 'test-shared-secret';

const { handleInteraction } = await import('../src/interactionHandler.js');

const ANSWERS = { tasking: 'Recon the ridge', callsigns: 'Alpha 1-1', fkia: '0 / 1 / 0', ekia: '4', report: 'Moved at 0400.' };

beforeEach(() => deleteDraft('u1', '12'));

function fakeInteraction(kind, extra = {}) {
    const calls = { deferReply: [], editReply: [], reply: [], showModal: [] };
    return {
        calls,
        isButton: () => kind === 'button',
        isModalSubmit: () => kind === 'modal',
        isChatInputCommand: () => false,
        user: { id: 'u1' },
        guildId: 'g1',
        deferReply: async (o) => calls.deferReply.push(o),
        editReply: async (o) => calls.editReply.push(o),
        reply: async (o) => calls.reply.push(o),
        showModal: async (m) => calls.showModal.push(m),
        ...extra,
    };
}

const textFields = (answers) => ({ getTextInputValue: (name) => answers[name] });

const fileFields = (answers, files) => ({
    getTextInputValue: (name) => answers[name],
    getUploadedFiles: (name) => new Map(files[name].map((url, i) => [String(i), { url }])),
});

test('the aarimg custom id is a patrol id and runs the AAR command', () => {
    assert.deepEqual(parsePatrolCustomId('patrol:aarimg:12'), {
        action: 'aarimg',
        id: '12',
        commandName: 'command-net-patrol-aar',
    });
});

test('step 1 asks for the template fields, in order, all required', () => {
    const modal = buildAarModal('12').toJSON();

    assert.equal(modal.custom_id, 'patrol:aar:12');
    const inputs = modal.components.map((label) => label.component);
    assert.deepEqual(inputs.map((i) => i.custom_id), ['tasking', 'callsigns', 'fkia', 'ekia', 'report']);
    assert.ok(inputs.every((i) => i.required !== false));
    assert.ok(modal.components.length <= 5, 'Discord allows at most 5 fields in a form');
});

test('step 2 requires at least one map and one intel image', () => {
    const modal = buildAarImagesModal('12').toJSON();

    assert.equal(modal.custom_id, 'patrol:aarimg:12');
    const uploads = modal.components.map((label) => label.component);
    assert.deepEqual(uploads.map((u) => [u.custom_id, u.min_values, u.max_values]), [
        ['map', 1, 5],
        ['intel', 1, 5],
    ]);
});

test('the Submit AAR button opens step 1', async () => {
    const interaction = fakeInteraction('button', { customId: 'patrol:aar:12' });

    await handleInteraction(interaction, { runCommand: async () => assert.fail('nothing to run yet') });

    assert.equal(interaction.calls.showModal[0].toJSON().custom_id, 'patrol:aar:12');
});

test('submitting step 1 keeps the answers and offers the image step privately', async () => {
    const interaction = fakeInteraction('modal', { customId: 'patrol:aar:12', fields: textFields(ANSWERS) });

    await handleInteraction(interaction, { runCommand: async () => assert.fail('the report is not filed yet') });

    assert.deepEqual(getDraft('u1', '12'), ANSWERS);
    const reply = interaction.calls.reply[0];
    assert.equal(reply.flags, MessageFlags.Ephemeral);
    assert.equal(reply.components[0].toJSON().components[0].custom_id, 'patrol:aarimg:12');
});

test('the image button opens step 2 when the answers are still there', async () => {
    saveDraft('u1', '12', ANSWERS);
    const interaction = fakeInteraction('button', { customId: 'patrol:aarimg:12' });

    await handleInteraction(interaction, { runCommand: async () => assert.fail('not yet') });

    assert.equal(interaction.calls.showModal[0].toJSON().custom_id, 'patrol:aarimg:12');
});

test('the image button says the form expired when the answers are gone', async () => {
    const interaction = fakeInteraction('button', { customId: 'patrol:aarimg:12' });

    await handleInteraction(interaction, { runCommand: async () => assert.fail('nothing to file') });

    assert.equal(interaction.calls.showModal.length, 0);
    assert.match(interaction.calls.reply[0].content, /expired/);
});

test('submitting step 2 files the report with the text answers and the image links', async () => {
    saveDraft('u1', '12', ANSWERS);
    const ran = [];
    const interaction = fakeInteraction('modal', {
        customId: 'patrol:aarimg:12',
        fields: fileFields({}, { map: ['https://cdn.discordapp.com/m1.png'], intel: ['https://cdn.discordapp.com/i1.png', 'https://cdn.discordapp.com/i2.png'] }),
    });

    await handleInteraction(interaction, { runCommand: async (c) => (ran.push(c), { embeds: [{ title: 'Filed' }] }) });

    assert.equal(ran[0].name, 'command-net-patrol-aar');
    assert.deepEqual(ran[0].options, {
        id: '12',
        ...ANSWERS,
        map_urls: JSON.stringify(['https://cdn.discordapp.com/m1.png']),
        intel_urls: JSON.stringify(['https://cdn.discordapp.com/i1.png', 'https://cdn.discordapp.com/i2.png']),
    });
    assert.deepEqual(interaction.calls.deferReply, [{ flags: MessageFlags.Ephemeral }]);
    assert.equal(getDraft('u1', '12'), null, 'a filed report clears the saved answers');
});

test('when forumify refuses the report the answers are kept so the images can be resent', async () => {
    saveDraft('u1', '12', ANSWERS);
    const interaction = fakeInteraction('modal', {
        customId: 'patrol:aarimg:12',
        fields: fileFields({}, { map: ['https://cdn.discordapp.com/m1.pdf'], intel: ['https://cdn.discordapp.com/i1.png'] }),
    });

    await handleInteraction(interaction, { runCommand: async () => ({ content: 'One of the images is not a picture.' }) });

    assert.deepEqual(getDraft('u1', '12'), ANSWERS);
    assert.equal(interaction.calls.editReply[0].content, 'One of the images is not a picture.');
});

test('step 2 without saved answers does not file anything', async () => {
    const interaction = fakeInteraction('modal', {
        customId: 'patrol:aarimg:12',
        fields: fileFields({}, { map: ['https://cdn.discordapp.com/m.png'], intel: ['https://cdn.discordapp.com/i.png'] }),
    });

    await handleInteraction(interaction, { runCommand: async () => assert.fail('nothing to file') });

    assert.match(interaction.calls.reply[0].content, /expired/);
});

test('saved answers are per person and per patrol, and expire', () => {
    const start = 1_000_000;
    saveDraft('u1', '12', ANSWERS, start);

    assert.equal(getDraft('u2', '12', start), null);
    assert.equal(getDraft('u1', '13', start), null);
    assert.deepEqual(getDraft('u1', '12', start + DRAFT_TTL_MS - 1), ANSWERS);
    assert.equal(getDraft('u1', '12', start + DRAFT_TTL_MS), null);
});
