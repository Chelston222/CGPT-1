'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildIntegrityReport, mediaIntegrity } = require('../scripts/linkedin-buffer-reliability.cjs');

const channelIds = { personal: 'chan-personal', main: 'chan-main', secondary: 'chan-secondary' };
const policy = { timezone: 'Europe/London', accounts: { personal: { maximumPerDay: 3, maximumPerWeek: 21 }, main: { maximumPerDay: 1, maximumPerWeek: 5 }, secondary: { maximumPerDay: 1, maximumPerWeek: 5 } } };
const providers = { personal: { id: 'chan-personal', connected: true, timezonePass: true, identityPass: true, recurringSlots: 7 }, main: { id: 'chan-main', connected: true, timezonePass: true, identityPass: true, recurringSlots: 5 }, secondary: { id: 'chan-secondary', connected: true, timezonePass: true, identityPass: true, recurringSlots: 5 } };

function baseQueue() {
  return [{ id: 'rs-test-001', revision: 1, title: 'Test document', targets: ['secondary'], mode: 'schedule', scheduledAt: { secondary: '2026-09-09T08:45:00+01:00' }, mediaUrl: 'https://raw.githubusercontent.com/example/repo/main/test.pdf', carousel: { readiness: 'ready', pdfSha256: 'a'.repeat(64), pdfBytes: 12345 } }];
}
function baseLive() { return [{ id: 'buffer-001', channelId: 'chan-secondary', dueAt: '2026-09-09T07:45:00.000Z', status: 'scheduled', isCustomScheduled: true, shareMode: 'customScheduled' }]; }
function baseLedger() { return [{ bufferId: 'buffer-001', queueId: 'rs-test-001', revision: '1', approvalIssue: 10, acceptedDueAt: '2026-09-09T07:45:00.000Z' }]; }

function report(overrides = {}) {
  return buildIntegrityReport({ livePosts: baseLive(), queuePosts: baseQueue(), ledgerEntries: baseLedger(), channelIds, policy, providerStates: providers, now: Date.parse('2026-09-08T12:00:00Z'), ...overrides });
}

test('resolves canonical nested carousel PDF integrity metadata', () => {
  const integrity = mediaIntegrity(baseQueue()[0]);
  assert.equal(integrity.sha256, 'a'.repeat(64));
  assert.equal(integrity.bytes, 12345);
});

test('keeps compatibility with top-level media integrity metadata', () => {
  const integrity = mediaIntegrity({ mediaSha256: 'b'.repeat(64), mediaBytes: 54321 });
  assert.equal(integrity.sha256, 'b'.repeat(64));
  assert.equal(integrity.bytes, 54321);
});

test('passes an exact locked, mapped, fixed-time placement', () => {
  const result = report();
  assert.equal(result.ok, true);
  assert.equal(result.mappedCount, 1);
  assert.equal(result.totalCount, 1);
  assert.deepEqual(result.failures, []);
});

test('equivalent repeated acceptance evidence is idempotent', () => {
  const ledger = baseLedger();
  ledger.push({ ...ledger[0], approvalIssue: 607 });
  const result = report({ ledgerEntries: ledger });
  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
});

test('conflicting acceptance evidence for one Buffer ID fails closed', () => {
  const ledger = baseLedger();
  ledger.push({ ...ledger[0], queueId: 'different-post' });
  const result = report({ ledgerEntries: ledger });
  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /Conflicting Buffer acceptance ledger evidence/);
});

test('fails closed when configured Buffer channel IDs are not unique', () => {
  const result = report({ channelIds: { ...channelIds, main: channelIds.secondary } });
  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /channel IDs must be unique/);
});

test('fails closed when a live Buffer placement has no trusted ledger mapping', () => {
  const result = report({ ledgerEntries: [] });
  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /no trusted approval\/acceptance ledger mapping/);
});

test('detects due-time drift between Buffer and the locked queue revision', () => {
  const live = baseLive();
  live[0].dueAt = '2026-09-09T08:15:00.000Z';
  const result = report({ livePosts: live });
  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /due-time drift/);
});

test('detects acceptance-ledger due-time drift', () => {
  const ledger = baseLedger();
  ledger[0].acceptedDueAt = '2026-09-09T08:15:00.000Z';
  const result = report({ ledgerEntries: ledger });
  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /acceptance-ledger due-time drift/);
});

test('detects unexpected live status', () => {
  const live = baseLive();
  live[0].status = 'sent';
  const result = report({ livePosts: live });
  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /unexpected status sent/);
});

test('detects duplicate live destinations for the same locked revision and target', () => {
  const live = baseLive();
  live.push({ ...live[0], id: 'buffer-002' });
  const ledger = baseLedger();
  ledger.push({ ...ledger[0], bufferId: 'buffer-002' });
  const result = report({ livePosts: live, ledgerEntries: ledger });
  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /Duplicate live destination/);
});

test('detects provider disconnection and recurring schedule overflow', () => {
  const providerStates = structuredClone(providers);
  providerStates.secondary.connected = false;
  providerStates.secondary.recurringSlots = 6;
  const result = report({ providerStates });
  assert.equal(result.ok, false);
  const text = result.failures.join('\n');
  assert.match(text, /disconnected, locked or paused/);
  assert.match(text, /above the governed 5\/week ceiling/);
});
