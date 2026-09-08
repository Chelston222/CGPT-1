'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const queue = require('../apps/linkedin-review/queue.json');
const curated = require('../apps/linkedin-review/qa-replenishment-2026-09-14-three-post-week-v1.json');
const override = require('../apps/linkedin-review/schedule-overrides-2026-09-08-three-post-window-v2.json');
const { validateWeeklyBatch, withQaReplenishment } = require('../scripts/linkedin-week-batch.cjs');

const ENV = {
  BUFFER_API_KEY: 'test-key',
  BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID: 'personal-id',
  BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID: 'main-id',
  BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID: 'secondary-id',
};

function approvalBody() {
  return [
    `BATCH_ID: ${override.batchId}`,
    `WEEK_START: ${override.windowStart}`,
    'WINDOW_MODE: ROLLING_7_DAY',
    `QUEUE_SCHEMA: ${queue.schemaVersion}`,
    `QUEUE_GENERATED_AT: ${queue.generatedAt}`,
    `APPROVED_ITEMS: ${override.posts.map((post) => `${post.id}@${post.revision}`).join(',')}`,
  ].join('\n');
}

test('rebased Sep 8 window is exactly 21 personal placements at three per day', () => {
  const batch = validateWeeklyBatch(approvalBody(), queue, ENV, Date.parse('2026-09-08T17:26:00Z'));
  assert.equal(batch.weekStart, '2026-09-08');
  assert.equal(batch.weekEnd, '2026-09-14');
  assert.equal(batch.windowMode, 'ROLLING_7_DAY');
  assert.equal(batch.jobs.length, 21);

  const placements = Object.entries(batch.placementsByDay).sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(placements.map(([date]) => date), [
    '2026-09-08',
    '2026-09-09',
    '2026-09-10',
    '2026-09-11',
    '2026-09-12',
    '2026-09-13',
    '2026-09-14',
  ]);
  for (const [date, count] of placements) assert.equal(count, 3, `${date} should contain exactly three account placements`);
  for (const job of batch.jobs) assert.deepEqual(job.post.targets, ['personal']);

  const today = batch.jobs.filter((job) => job.post.scheduledAt.personal.startsWith('2026-09-08'));
  assert.equal(today.length, 3);
  assert.deepEqual(today.map((job) => job.post.scheduledAt.personal.slice(11, 16)), ['19:00', '20:00', '21:00']);
  assert.deepEqual(today.map((job) => job.post.revision), [3, 3, 3]);
});

test('realigned revisions remain review-only until owner approval', () => {
  const effective = withQaReplenishment({ ...queue, posts: [] }, {
    applyScheduleOverrides: true,
    batchId: override.batchId,
  });
  const selected = override.posts.map((locked) => effective.posts.find((post) => post.id === locked.id));
  assert.equal(selected.length, 21);
  for (let index = 0; index < selected.length; index += 1) {
    const post = selected[index];
    assert.ok(post);
    assert.equal(post.status, 'review');
    assert.equal(post.qa.status, 'ready_for_human_review');
    assert.equal(post.qa.approvalEligible, true);
    assert.equal(post.qa.publishPermission, false);
    assert.equal(post.revision, index < 3 ? 3 : 2);
  }
});

test('curated copy remains unchanged, unique and free of em dashes', () => {
  const copies = curated.posts.map((post) => post.copy.default);
  assert.equal(copies.some((copy) => copy.includes('—')), false);
  assert.equal(new Set(copies).size, copies.length);
});
