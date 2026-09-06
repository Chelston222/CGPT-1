'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CONFIG_START, CONFIG_END, parseIntakeIssue } = require('../scripts/linkedin-imap-intake-config.cjs');

const future = '2026-09-11T08:45:00+01:00';
const now = Date.parse('2026-09-06T08:00:00Z');

function fixture(overrides = {}) {
  const config = {
    id: 'rs-li-retention-school-part-1',
    expectedSubject: 'TTE LINKEDIN PDF INTAKE rs-li-retention-school-part-1',
    expectedSender: 'tripletwochelston@gmail.com',
    expectedFilename: 'Retention School Part 1 Diagnose the Leak.pdf',
    expectedSha256: 'a'.repeat(64),
    expectedBytes: 3562430,
    expectedPages: 10,
    manifest: {
      schemaVersion: 1,
      id: 'rs-li-retention-school-part-1',
      revision: 1,
      title: 'Part 1: Diagnose the Leak',
      documentTitle: 'Retention School Part 1 Diagnose the Leak',
      category: 'buyer_diagnostics',
      funnelStage: 'mof',
      targets: ['secondary'],
      mode: 'schedule',
      scheduledAt: { secondary: future },
      copy: { default: 'Useful copy\n\n#RetentionSchool' },
      mediaAlt: 'Ten-slide Retention School carousel.',
      expectedSha256: 'a'.repeat(64),
      sourceUrl: 'https://app.notion.com/p/1234567890abcdef1234567890abcdef',
    },
    ...overrides,
  };
  return `${CONFIG_START}\n${JSON.stringify(config)}\n${CONFIG_END}`;
}

test('accepts a locked owner intake config', () => {
  const result = parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture(), now);
  assert.equal(result.id, 'rs-li-retention-school-part-1');
  assert.equal(result.expectedPages, 10);
  assert.equal(result.manifest.targets[0], 'secondary');
});

test('rejects title/config ID mismatch', () => {
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] wrong-id', fixture(), now), /must exactly match/);
});

test('rejects a different sender', () => {
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({ expectedSender: 'attacker@example.com' }), now), /expectedSender/);
});

test('rejects SHA drift between transport and manifest', () => {
  const body = fixture({ expectedSha256: 'b'.repeat(64) });
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', body, now), /manifest.expectedSha256/);
});

test('rejects stale or near-term schedules', () => {
  const config = JSON.parse(fixture().split(CONFIG_START)[1].split(CONFIG_END)[0]);
  config.manifest.scheduledAt.secondary = '2026-09-06T08:05:00Z';
  const body = `${CONFIG_START}\n${JSON.stringify(config)}\n${CONFIG_END}`;
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', body, now), /more than 10 minutes/);
});

test('rejects em dashes in approved copy', () => {
  const config = JSON.parse(fixture().split(CONFIG_START)[1].split(CONFIG_END)[0]);
  config.manifest.copy.default = 'Bad — copy';
  const body = `${CONFIG_START}\n${JSON.stringify(config)}\n${CONFIG_END}`;
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', body, now), /em dashes/);
});
