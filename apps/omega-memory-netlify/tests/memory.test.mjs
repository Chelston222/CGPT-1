import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRecords, searchIndex } from '../lib/memory.mjs';

test('canonical durable outranks historical evidence', () => {
  const index = { records: [
    { id: 'h', title: 'Old chat', text: 'Client Return Systems', source_class: 'historical_evidence', canonical_status: 'noncanonical' },
    { id: 'd', title: 'Current source', text: 'Client Return Systems', source_class: 'durable', canonical_status: 'CURRENT CANONICAL' }
  ] };
  assert.equal(searchIndex(index, 'Client Return Systems', 5)[0].id, 'd');
});

test('merge replaces matching ids', () => {
  const merged = mergeRecords([{ id: 'a', text: 'old' }], [{ id: 'a', text: 'new' }, { id: 'b', text: 'two' }]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((r) => r.id === 'a').text, 'new');
});
