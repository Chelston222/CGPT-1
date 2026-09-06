'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  acceptanceComment,
  acceptanceKey,
  acceptanceMarker,
  acceptedKeys,
  parseAcceptanceEntries,
} = require('../scripts/linkedin-buffer-acceptance-ledger.cjs');

test('builds stable placement keys and durable acceptance markers', () => {
  const key = acceptanceKey('rs-li-demo', 2, 'secondary');
  assert.equal(key, 'rs-li-demo@2:secondary');
  assert.equal(
    acceptanceMarker({ key, bufferId: 'buf-123', dueAt: '2026-09-16T07:45:00.000Z' }),
    '<!-- BUFFER_ACCEPTED rs-li-demo@2:secondary bufferId=buf-123 dueAt=2026-09-16T07:45:00.000Z -->',
  );
});

test('parses only trusted bot ledger comments', () => {
  const comments = [
    { user: { login: 'someone-else' }, body: '<!-- BUFFER_ACCEPTED bad@1:secondary bufferId=bad -->' },
    { user: { login: 'github-actions[bot]' }, body: '<!-- BUFFER_ACCEPTED rs-li-demo@2:secondary bufferId=buf-123 dueAt=2026-09-16T07:45:00.000Z -->' },
  ];
  const entries = parseAcceptanceEntries(comments);
  assert.deepEqual([...entries.keys()], ['rs-li-demo@2:secondary']);
  assert.deepEqual([...acceptedKeys(comments)], ['rs-li-demo@2:secondary']);
});

test('rejects conflicting Buffer IDs for one accepted placement key', () => {
  const comments = [
    '<!-- BUFFER_ACCEPTED rs-li-demo@2:secondary bufferId=buf-123 -->',
    '<!-- BUFFER_ACCEPTED rs-li-demo@2:secondary bufferId=buf-456 -->',
  ];
  assert.throws(() => parseAcceptanceEntries(comments), /Acceptance ledger conflict/);
});

test('acceptance comment carries exact queue, target and media audit evidence', () => {
  const body = acceptanceComment({
    key: 'rs-li-demo@2:secondary',
    queueId: 'rs-li-demo',
    revision: 2,
    targetName: '222 Emails | Retention Lab',
    target: 'secondary',
    bufferId: 'buf-123',
    dueAt: '2026-09-16T07:45:00.000Z',
    mediaProof: { bytes: 1234, sha256: 'a'.repeat(64) },
  });
  assert.match(body, /buf-123/);
  assert.match(body, /1234 bytes/);
  assert.match(body, /rs-li-demo@2:secondary/);
});
