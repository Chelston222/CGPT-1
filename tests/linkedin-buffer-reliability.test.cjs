'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildIntegrityReport } = require('../scripts/linkedin-buffer-reliability.cjs');

const channelIds = {
  personal: 'chan-personal',
  main: 'chan-main',
  secondary: 'chan-secondary',
};

const policy = {
  timezone: 'Europe/London',
  accounts: {
    personal: { maximumPerDay: 2, maximumPerWeek: 14 },
    main: { maximumPerDay: 1, maximumPerWeek: 5 },
    secondary: { maximumPerDay: 1, maximumPerWeek: 5 },
  },
};

const providers = {
  personal: { id: 'chan-personal', connected: true, timezonePass: true, identityPass: true, recurringSlots: 7 },
  main: { id: 'chan-main', connected: true, timezonePass: true, identityPass: true, recurringSlots: 5 },
  secondary: { id: 'chan-secondary', connected: true, timezonePass: true, identityPass: true, recurringSlots: 5 },
};

function baseQueue() {
  return [{
    id: 'rs-test-001',
    revision: 1,
    title: 'Test document',
    targets: ['secondary'],
    mode: 'schedule',
    scheduledAt: { secondary: '2026-09-09T08:45:00+01:00' },
    mediaUrl: 'https://raw.githubusercontent.com/example/repo/main/test.pdf',
    mediaSha256: 'a'.repeat(64),
    mediaBytes: 12345,
  }];
}

function baseLive() {
  return [{
    id: 'buffer-001',
    channelId: 'chan-secondary',
    dueAt: '2026-09-09T07:45:00.000Z',
    status: 'scheduled',
    isCustomScheduled: true,
    shareMode: 'customScheduled',
  }];
}

function baseLedger() {
  return [{ bufferId: 'buffer-001', queueId: 'rs-test-001', revision: '1', approvalIssue: 10 }];
}

test('passes an exact locked, mapped, fixed-time placement', () => {
  const report = buildIntegrityReport({
    livePosts: baseLive(),
    queuePosts: baseQueue(),
    ledgerEntries: baseLedger(),
    channelIds,
    policy,
    providerStates: providers,
    now: Date.parse('2026-09-08T12:00:00Z'),
  });
  assert.equal(report.ok, true);
  assert.equal(report.mappedCount, 1);
  assert.equal(report.totalCount, 1);
  assert.deepEqual(report.failures, []);
});

test('fails closed when a live Buffer placement has no trusted ledger mapping', () => {
  const report = buildIntegrityReport({
    livePosts: baseLive(),
    queuePosts: baseQueue(),
    ledgerEntries: [],
    channelIds,
    policy,
    providerStates: providers,
    now: Date.parse('2026-09-08T12:00:00Z'),
  });
  assert.equal(report.ok, false);
  assert.match(report.failures.join('\n'), /no trusted approval\/acceptance ledger mapping/);
});

test('detects due-time drift between Buffer and the locked queue revision', () => {
  const live = baseLive();
  live[0].dueAt = '2026-09-09T08:15:00.000Z';
  const report = buildIntegrityReport({
    livePosts: live,
    queuePosts: baseQueue(),
    ledgerEntries: baseLedger(),
    channelIds,
    policy,
    providerStates: providers,
    now: Date.parse('2026-09-08T12:00:00Z'),
  });
  assert.equal(report.ok, false);
  assert.match(report.failures.join('\n'), /due-time drift/);
});

test('detects duplicate live destinations for the same locked revision and target', () => {
  const live = baseLive();
  live.push({ ...live[0], id: 'buffer-002' });
  const ledger = baseLedger();
  ledger.push({ bufferId: 'buffer-002', queueId: 'rs-test-001', revision: '1', approvalIssue: 10 });
  const report = buildIntegrityReport({
    livePosts: live,
    queuePosts: baseQueue(),
    ledgerEntries: ledger,
    channelIds,
    policy,
    providerStates: providers,
    now: Date.parse('2026-09-08T12:00:00Z'),
  });
  assert.equal(report.ok, false);
  assert.match(report.failures.join('\n'), /Duplicate live destination/);
});

test('detects provider disconnection and recurring schedule overflow', () => {
  const providerStates = structuredClone(providers);
  providerStates.secondary.connected = false;
  providerStates.secondary.recurringSlots = 6;
  const report = buildIntegrityReport({
    livePosts: baseLive(),
    queuePosts: baseQueue(),
    ledgerEntries: baseLedger(),
    channelIds,
    policy,
    providerStates,
    now: Date.parse('2026-09-08T12:00:00Z'),
  });
  assert.equal(report.ok, false);
  const text = report.failures.join('\n');
  assert.match(text, /disconnected, locked or paused/);
  assert.match(text, /above the governed 5\/week ceiling/);
});
