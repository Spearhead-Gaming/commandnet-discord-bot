import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDataPayload } from '../src/dataPayload.js';

test('accepts a valid RolesChanged payload', () => {
    const payload = { type: 'RolesChanged', guildId: '1', discordIdentifier: '2', rolesAdded: ['3'], rolesRemoved: [] };
    assert.deepEqual(validateDataPayload(payload), payload);
});

test('accepts a RolesChanged payload shaped as JSON-LD (@type instead of type)', () => {
    const payload = { '@type': 'RolesChanged', guildId: '1', discordIdentifier: '2', rolesAdded: ['3'], rolesRemoved: [] };
    // httpServer dispatches on payload.type, so it has to come back populated.
    assert.deepEqual(validateDataPayload(payload), { ...payload, type: 'RolesChanged' });
});

test('accepts a valid UsernameChanged payload', () => {
    const payload = { type: 'UsernameChanged', guildId: '1', discordIdentifier: '2', newUsername: 'Cpl Doe' };
    assert.deepEqual(validateDataPayload(payload), payload);
});

test('accepts a valid PostMessage payload', () => {
    const payload = { type: 'PostMessage', guildId: '1', channelId: '2', content: 'hi' };
    assert.deepEqual(validateDataPayload(payload), payload);
});

test('rejects an unknown type', () => {
    assert.throws(() => validateDataPayload({ type: 'Nope', guildId: '1' }));
});

test('rejects a missing guildId', () => {
    assert.throws(() => validateDataPayload({ type: 'RolesChanged', discordIdentifier: '1', rolesAdded: [], rolesRemoved: [] }));
});

test('rejects PostMessage without content or embed', () => {
    assert.throws(() => validateDataPayload({ type: 'PostMessage', guildId: '1', channelId: '2' }));
});

test('CreateInvite needs a channel', () => {
    assert.throws(() => validateDataPayload({ type: 'CreateInvite', guildId: '1' }));
    validateDataPayload({ type: 'CreateInvite', guildId: '1', channelId: '2' });
});

test('DirectMessage needs a user and content or embed', () => {
    assert.throws(() => validateDataPayload({ type: 'DirectMessage', guildId: '1', content: 'hi' }));
    assert.throws(() => validateDataPayload({ type: 'DirectMessage', guildId: '1', discordUserId: '2' }));
    validateDataPayload({ type: 'DirectMessage', guildId: '1', discordUserId: '2', content: 'hi' });
});
