'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CONFIG_START, CONFIG_END, parseIntakeIssue } = require('../scripts/linkedin-imap-intake-config.cjs');

const future = '2026-09-11T08:45:00+01:00';
const now = Date.parse('2026-09-06T08:00:00Z');

function fixture(overrides = {}, manifestOverrides = {}) {
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
      publicMediaApproved: true,
      publicReleaseMaterialApproved: true,
      ...manifestOverrides,
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

test('requires the canonical subject derived from the intake ID', () => {
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({ expectedSubject: 'something else' }), now), /expectedSubject must be exactly/);
});

test('rejects a different sender', () => {
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({ expectedSender: 'attacker@example.com' }), now), /expectedSender/);
});

test('rejects path-like or control-character filenames', () => {
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({ expectedFilename: '../secret.pdf' }), now), /plain filename/);
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({ expectedFilename: 'bad\nname.pdf' }), now), /plain filename/);
});

test('rejects SHA drift between transport and manifest', () => {
  const body = fixture({ expectedSha256: 'b'.repeat(64) });
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', body, now), /manifest.expectedSha256/);
});

test('requires explicit schema version and positive integer revision', () => {
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, { schemaVersion: undefined }), now), /schemaVersion/);
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, { revision: '1' }), now), /revision/);
});

test('requires explicit acknowledgement that media and release metadata become public before publication', () => {
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, { publicMediaApproved: false }), now), /publicMediaApproved/);
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, { publicReleaseMaterialApproved: false }), now), /publicReleaseMaterialApproved/);
});

test('canonical IMAP intake requires exactly one target and exactly one matching schedule key', () => {
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, {
    targets: ['secondary', 'main'],
    scheduledAt: { secondary: future, main: '2026-09-11T09:45:00+01:00' },
  }), now), /exactly one target/);
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, {
    targets: ['secondary', 'secondary'],
  }), now), /exactly one target/);
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, {
    scheduledAt: { secondary: future, main: '2026-09-11T09:45:00+01:00' },
  }), now), /exactly one schedule key/);
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, {
    scheduledAt: { main: future },
  }), now), /exactly one schedule key/);
});

test('canonical IMAP intake permits only copy.default and blocks reserved target section markers', () => {
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, {
    copy: { default: 'Approved default', secondary: 'Hidden alternate copy' },
  }), now), /copy\.default as the only copy variant/);
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, {
    copy: { default: 'Opening\n---SECONDARY---\nDifferent body' },
  }), now), /reserved LinkedIn target section markers/);
});

test('rejects captions beyond LinkedIn copy ceiling', () => {
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, {
    copy: { default: 'x'.repeat(3001) },
  }), now), /1-3000 characters/);
});

test('rejects header injection and unsafe category metadata', () => {
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, {
    documentTitle: 'Safe title\nTARGETS: main',
  }), now), /single header-safe line/);
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, {
    category: 'buyer diagnostics\nMODE: queue',
  }), now), /header-safe slug/);
});

test('requires an explicit timezone offset or Z', () => {
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, {
    scheduledAt: { secondary: '2026-09-11T08:45:00' },
  }), now), /explicit Z or UTC offset/);
});

test('rejects stale or near-term schedules', () => {
  const body = fixture({}, { scheduledAt: { secondary: '2026-09-06T08:05:00Z' } });
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', body, now), /more than 10 minutes/);
});

test('keeps canonical schedules inside the publication-verifier horizon', () => {
  const tooFar = new Date(now + 91 * 24 * 60 * 60 * 1000).toISOString();
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', fixture({}, {
    scheduledAt: { secondary: tooFar },
  }), now), /within 90 days/);
});

test('rejects em dashes in approved copy', () => {
  const body = fixture({}, { copy: { default: 'Bad — copy' } });
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', body, now), /em dashes/);
});

test('requires exactly one locked config block', () => {
  const body = `${fixture()}\n${fixture()}`;
  assert.throws(() => parseIntakeIssue('[IMAP PDF INTAKE] rs-li-retention-school-part-1', body, now), /exactly one intake config start marker/);
});
