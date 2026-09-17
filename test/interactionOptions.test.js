import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flattenOptions } from '../src/interactionOptions.js';

test('flattens discord.js option data into a plain object', () => {
    const data = [
        { name: 'name', value: '1st Squad', type: 3 },
        { name: 'count', value: 5, type: 4 },
    ];
    assert.deepEqual(flattenOptions(data), { name: '1st Squad', count: 5 });
});

test('handles undefined options', () => {
    assert.deepEqual(flattenOptions(undefined), {});
});

test('handles empty options', () => {
    assert.deepEqual(flattenOptions([]), {});
});
