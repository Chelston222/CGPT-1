'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  acceptanceComment,
  acceptanceKey,
  acceptanceMarker,
  acceptedKeys,
  dispatchIntentComment,
  dispatchIntentMarker,
  parseAcceptanceEntries,
  selectTrustedLedgerIssue,
  unresolvedIntentKeys,
} = require('../scripts/linkedin-buffer-acceptance-ledger.cjs');

test('builds stable placement keys and durable acceptance markers', () => {
  const key = acceptanceKey('rs-li-demo', 2, 'secondary');
  assert.equal(key, 'rs-li-demo@2:secondary');
  assert.equal(acceptanceMarker({ key, bufferId: 'buf-123', dueAt: '2026-09-16T07:45:00.000Z' }), '<!-- BUFFER_ACCEPTED rs-li-demo@2:secondary bufferId=buf-123 dueAt=2026-09-16T07:45:00.000Z -->');
  assert.equal(dispatchIntentMarker(key), '<!-- BUFFER_DISPATCH_INTENT rs-li-demo@2:secondary -->');
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

test('an intent without acceptance blocks automatic recreation', () => {
  const comments = [{ user: { login: 'github-actions[bot]' }, body: dispatchIntentMarker('rs-li-demo@2:secondary') }];
  assert.deepEqual([...unresolvedIntentKeys(comments)], ['rs-li-demo@2:secondary']);
});

test('matching acceptance resolves a dispatch intent', () => {
  const comments = [{ user: { login: 'github-actions[bot]' }, body: `${dispatchIntentMarker('rs-li-demo@2:secondary')}\n${acceptanceMarker({ key: 'rs-li-demo@2:secondary', bufferId: 'buf-123' })}` }];
  assert.deepEqual([...unresolvedIntentKeys(comments)], []);
});

test('selects a durable ledger created by the actions bot instead of requiring owner authorship', () => {
  const issues = [
    { number: 1, title: '[BUFFER ACCEPTANCE LEDGER] LinkedIn governed releases', user: { login: 'outside-user' } },
    { number: 2, title: '[BUFFER ACCEPTANCE LEDGER] LinkedIn governed releases', user: { login: 'github-actions[bot]' } },
  ];
  assert.equal(selectTrustedLedgerIssue(issues, 'Chelston222').number, 2);
});

test('fails closed when more than one trusted durable ledger exists', () => {
  const issues = [
    { number: 2, title: '[BUFFER ACCEPTANCE LEDGER] LinkedIn governed releases', user: { login: 'github-actions[bot]' } },
    { number: 3, title: '[BUFFER ACCEPTANCE LEDGER] LinkedIn governed releases', user: { login: 'Chelston222' } },
  ];
  assert.throws(() => selectTrustedLedgerIssue(issues, 'Chelston222'), /split-brain/i);
});

test('dispatch intent comment explains the fail-safe recovery boundary', () => {
  const body = dispatchIntentComment({ key: 'rs-li-demo@2:secondary', queueId: 'rs-li-demo', revision: 2, targetName: 'Retention School', target: 'secondary' });
  assert.match(body, /automatic recreation must stop/i);
  assert.match(body, /BUFFER_DISPATCH_INTENT/);
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
