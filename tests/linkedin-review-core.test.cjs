'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCreatePostMutation,
  normaliseTargets,
  parseIssueBody,
  validateRequest,
} = require('../scripts/linkedin-review-core.cjs');

const ENV = {
  BUFFER_API_KEY: 'test-key',
  BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID: 'personal-id',
  BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID: 'main-id',
  BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID: 'secondary-id',
};

test('keeps backwards-compatible target aliases', () => {
  assert.deepEqual(normaliseTargets('business'), ['main']);
  assert.deepEqual(normaliseTargets('both'), ['personal', 'main']);
  assert.deepEqual(normaliseTargets('all'), ['personal', 'main', 'secondary']);
});

test('accepts explicit target combinations without duplicates', () => {
  assert.deepEqual(normaliseTargets('personal, main, personal, secondary'), [
    'personal',
    'main',
    'secondary',
  ]);
});

test('parses channel-specific copy variants', () => {
  const parsed = parseIssueBody(`POST_ID: tte-001\nTARGETS: personal,main\nMODE: draft\n---\nFallback copy\n---PERSONAL---\nPersonal copy\n---MAIN---\nMain copy`);
  assert.equal(parsed.copy.default, 'Fallback copy');
  assert.equal(parsed.copy.personal, 'Personal copy');
  assert.equal(parsed.copy.main, 'Main copy');
});

test('preflights all target secrets before returning a request', () => {
  const body = `POST_ID: tte-001\nTARGETS: personal,secondary\nMODE: draft\n---\nSafe draft copy`;
  assert.throws(
    () => validateRequest(body, { ...ENV, BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID: '' }),
    /BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID/,
  );
});

test('supports staggered schedules for combinations', () => {
  const body = `POST_ID: tte-001\nTARGETS: personal,main\nMODE: schedule\nSCHEDULE_AT_PERSONAL: 2026-09-01T08:15:00+01:00\nSCHEDULE_AT_MAIN: 2026-09-02T09:00:00+01:00\n---\nDefault\n---PERSONAL---\nPersonal angle\n---MAIN---\nMain angle`;
  const result = validateRequest(body, ENV, Date.parse('2026-08-09T00:00:00Z'));
  assert.equal(result.channels[0].dueAt, '2026-09-01T07:15:00.000Z');
  assert.equal(result.channels[1].dueAt, '2026-09-02T08:00:00.000Z');
  assert.equal(result.channels[1].text, 'Main angle');
});

test('rejects past schedules, unsafe media and empty copy', () => {
  assert.throws(
    () => validateRequest('TARGETS: personal\nMODE: schedule\nSCHEDULE_AT: 2020-01-01T00:00:00Z\n---\nCopy', ENV),
    /future/,
  );
  assert.throws(
    () => validateRequest('TARGETS: personal\nMODE: draft\nMEDIA_URL: http://example.com/a.png\n---\nCopy', ENV),
    /HTTPS/,
  );
  assert.throws(
    () => validateRequest('TARGETS: personal\nMODE: draft\n---\n', ENV),
    /empty/,
  );
});

test('non-publishing test mutation cannot accidentally schedule or publish', () => {
  const mutation = buildCreatePostMutation({ id: 'id', text: 'copy', dueAt: null }, 'draft');
  assert.match(mutation, /saveToDraft: true/);
  assert.doesNotMatch(mutation, /customScheduled/);
  assert.doesNotMatch(mutation, /dueAt/);
});
