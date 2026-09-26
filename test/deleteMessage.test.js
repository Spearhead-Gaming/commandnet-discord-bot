import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDataPayload } from '../src/dataPayload.js';
import { applyDeleteMessage } from '../src/discordActions.js';

function fakeClient(deleteMessage) {
    const channel = { id: '2', isTextBased: () => true, messages: { delete: deleteMessage } };
    return { channels: { fetch: async () => channel } };
}

test('validates DeleteMessage payloads', () => {
    const base = { type: 'DeleteMessage', guildId: '1', channelId: '2', messageId: '3' };

    assert.doesNotThrow(() => validateDataPayload(base));
    assert.doesNotThrow(() => validateDataPayload({ '@type': 'DeleteMessage', guildId: '1', channelId: '2', messageId: '3' }));
    assert.throws(() => validateDataPayload({ ...base, messageId: undefined }));
    assert.throws(() => validateDataPayload({ ...base, channelId: undefined }));
    assert.throws(() => validateDataPayload({ ...base, guildId: undefined }));
});

test('a DeleteMessage sent as JSON-LD comes back with its type filled in', () => {
    const payload = validateDataPayload({ '@type': 'DeleteMessage', guildId: '1', channelId: '2', messageId: '3' });

    assert.equal(payload.type, 'DeleteMessage');
});

test('deletes the message', async () => {
    const deleted = [];

    await applyDeleteMessage(fakeClient(async (id) => deleted.push(id)), { channelId: '2', messageId: '3' });

    assert.deepEqual(deleted, ['3']);
});

test('a message that is already gone counts as deleted', async () => {
    const gone = Object.assign(new Error('Unknown Message'), { code: 10008 });

    await assert.doesNotReject(applyDeleteMessage(fakeClient(async () => { throw gone; }), { channelId: '2', messageId: '3' }));
});

test('any other Discord error is not swallowed', async () => {
    const forbidden = Object.assign(new Error('Missing Permissions'), { code: 50013 });

    await assert.rejects(
        applyDeleteMessage(fakeClient(async () => { throw forbidden; }), { channelId: '2', messageId: '3' }),
        /Missing Permissions/,
    );
});
