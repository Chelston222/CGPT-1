'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { postBody } = require('../scripts/linkedin-week-batch.cjs');
const { validateRequest } = require('../scripts/linkedin-review-core.cjs');

function post() {
  return {
    id: 'tte-reserve-133', revision: 1, category: 'repeat_bookings', targets: ['personal'], mode: 'schedule', sourceType: 'notion_reserve',
    scheduledAt: { personal: '2026-09-18T08:15:00+01:00' },
    copy: { default: 'Locked reserve caption' },
    mediaUrl: 'https://raw.githubusercontent.com/Chelston222/CGPT-1/main/assets/linkedin-generated/reserve-01.png',
    mediaAlt: 'Standalone client return poster.', mediaBytes: 1014086, mediaSha256: 'a'.repeat(64), safeZoneQa: 'pass', format: 'poster',
  };
}
const baseEnv = {
  BUFFER_API_KEY: 'test',
  BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID: 'personal-channel',
};

test('reserve approval body explicitly requires the live Notion gate', () => {
  assert.match(postBody(post()), /^NOTION_LIVE_GATE: REQUIRED$/m);
});

test('reserve approval fails before provider work when Notion credential is absent', () => {
  assert.throws(() => validateRequest(postBody(post()), baseEnv, Date.parse('2026-09-15T06:00:00Z')), /Missing NOTION_API_KEY/);
});

test('reserve approval validates when both Buffer and Notion credentials exist', () => {
  const request = validateRequest(postBody(post()), { ...baseEnv, NOTION_API_KEY: 'test-notion' }, Date.parse('2026-09-15T06:00:00Z'));
  assert.equal(request.postId, 'tte-reserve-133');
  assert.equal(request.channels[0].target, 'personal');
});

test('legacy approved content without reserve header does not gain a new Notion-secret dependency', () => {
  const legacy = { ...post(), sourceType: 'qa_replenishment' };
  const body = postBody(legacy);
  assert.doesNotMatch(body, /^NOTION_LIVE_GATE:/m);
  const request = validateRequest(body, baseEnv, Date.parse('2026-09-15T06:00:00Z'));
  assert.equal(request.postId, 'tte-reserve-133');
});