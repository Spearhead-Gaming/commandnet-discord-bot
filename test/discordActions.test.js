import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMemberSummaries } from '../src/discordActions.js';

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
