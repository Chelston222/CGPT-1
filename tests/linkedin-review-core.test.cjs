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

test('requires explicit content QA and image safe-zone QA', () => {
  assert.throws(
    () => validateRequest('TARGETS: personal\nMODE: draft\n---\nCopy', ENV),
    /CONTENT_QA: PASS/,
  );
  assert.throws(
    () => validateRequest('TARGETS: personal\nMODE: draft\nCONTENT_QA: PASS\nMEDIA_URL: https://example.com/a.png\nMEDIA_KIND: image\nALT_TEXT: Example\n---\nCopy', ENV),
    /SAFE_ZONE_QA: PASS/,
  );
});

test('preflights all target secrets before returning a request', () => {
  const body = `POST_ID: tte-001\nTARGETS: personal,secondary\nMODE: draft\nCONTENT_QA: PASS\n---\nSafe draft copy`;
  assert.throws(
    () => validateRequest(body, { ...ENV, BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID: '' }),
    /BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID/,
  );
});

test('supports staggered schedules for combinations', () => {
  const body = `POST_ID: tte-001\nTARGETS: personal,main\nMODE: schedule\nCONTENT_QA: PASS\nSCHEDULE_AT_PERSONAL: 2026-09-01T08:15:00+01:00\nSCHEDULE_AT_MAIN: 2026-09-02T09:00:00+01:00\n---\nDefault\n---PERSONAL---\nPersonal angle\n---MAIN---\nMain angle`;
  const result = validateRequest(body, ENV, Date.parse('2026-08-09T00:00:00Z'));
  assert.equal(result.channels[0].dueAt, '2026-09-01T07:15:00.000Z');
  assert.equal(result.channels[1].dueAt, '2026-09-02T08:00:00.000Z');
  assert.equal(result.channels[1].text, 'Main angle');
  assert.equal(result.contentQa, 'pass');
});

test('rejects past schedules, unsafe media and empty copy', () => {
  assert.throws(
    () => validateRequest('TARGETS: personal\nMODE: schedule\nCONTENT_QA: PASS\nSCHEDULE_AT: 2020-01-01T00:00:00Z\n---\nCopy', ENV),
    /future/,
  );
  assert.throws(
    () => validateRequest('TARGETS: personal\nMODE: draft\nCONTENT_QA: PASS\nSAFE_ZONE_QA: PASS\nMEDIA_URL: http://example.com/a.png\nALT_TEXT: Example\n---\nCopy', ENV),
    /HTTPS/,
  );
  assert.throws(
    () => validateRequest('TARGETS: personal\nMODE: draft\nCONTENT_QA: PASS\n---\n', ENV),
    /empty/,
  );
});

test('non-publishing test mutation cannot accidentally schedule or publish', () => {
  const mutation = buildCreatePostMutation({ id: 'id', text: 'copy', dueAt: null }, 'draft');
  const input = mutation.match(/createPost\(input:\s*\{([\s\S]*?)\}\)\s*\{/)[1];
  assert.match(input, /saveToDraft: true/);
  assert.match(input, /mode: addToQueue/);
  assert.doesNotMatch(input, /customScheduled/);
  assert.doesNotMatch(input, /dueAt\s*:/);
});

test('LinkedIn image media requires alt text and preserves it in Buffer metadata', () => {
  assert.throws(
    () => validateRequest('TARGETS: personal\nMODE: draft\nCONTENT_QA: PASS\nSAFE_ZONE_QA: PASS\nMEDIA_URL: https://example.com/a.png\nMEDIA_KIND: image\n---\nCopy', ENV),
    /ALT_TEXT/,
  );
  const request = validateRequest('TARGETS: personal\nMODE: draft\nCONTENT_QA: PASS\nSAFE_ZONE_QA: PASS\nMEDIA_URL: https://example.com/a.png\nMEDIA_KIND: image\nALT_TEXT: Revenue recovery diagram\n---\nCopy', ENV);
  assert.equal(request.mediaAltText, 'Revenue recovery diagram');
  assert.equal(request.safeZoneQa, 'pass');
  const mutation = buildCreatePostMutation(
    { id: 'id', text: 'copy', dueAt: null },
    'draft',
    { url: request.mediaUrl, kind: 'image', altText: request.mediaAltText },
  );
  assert.match(mutation, /metadata: \{ altText:/);
  assert.match(mutation, /Revenue recovery diagram/);
});

test('LinkedIn PDF documents require locked page count and use a document asset', () => {
  assert.throws(
    () => validateRequest('TARGETS: personal\nMODE: schedule\nCONTENT_QA: PASS\nSCHEDULE_AT: 2026-09-01T08:00:00Z\nMEDIA_URL: https://example.com/carousel.pdf\nMEDIA_KIND: document\n---\nCopy', ENV, Date.parse('2026-08-09T00:00:00Z')),
    /DOCUMENT_TITLE/,
  );
  assert.throws(
    () => validateRequest('TARGETS: personal\nMODE: schedule\nCONTENT_QA: PASS\nSCHEDULE_AT: 2026-09-01T08:00:00Z\nMEDIA_URL: https://example.com/carousel.pdf\nMEDIA_KIND: document\nDOCUMENT_TITLE: Carousel\nDOCUMENT_THUMBNAIL_URL: https://example.com/cover.png\n---\nCopy', ENV, Date.parse('2026-08-09T00:00:00Z')),
    /DOCUMENT_PAGE_COUNT/,
  );
  const request = validateRequest('TARGETS: personal\nMODE: schedule\nCONTENT_QA: PASS\nSCHEDULE_AT: 2026-09-01T08:00:00Z\nMEDIA_URL: https://example.com/carousel.pdf\nMEDIA_KIND: document\nDOCUMENT_TITLE: Carousel\nDOCUMENT_THUMBNAIL_URL: https://example.com/cover.png\nDOCUMENT_PAGE_COUNT: 6\nMEDIA_BYTES: 1000\nMEDIA_SHA256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n---\nCopy', ENV, Date.parse('2026-08-09T00:00:00Z'));
  assert.equal(request.documentPageCount, 6);
  assert.equal(request.mediaBytes, 1000);
  const mutation = buildCreatePostMutation(
    { id: 'id', text: 'copy', dueAt: '2026-09-01T08:00:00.000Z' },
    'schedule',
    { url: request.mediaUrl, kind: 'document', title: 'Five follow-up leaks', thumbnailUrl: request.documentThumbnailUrl },
  );
  assert.match(mutation, /document:/);
  assert.match(mutation, /Five follow-up leaks/);
  assert.match(mutation, /thumbnailUrl/);
  assert.doesNotMatch(mutation, /image:/);
});
