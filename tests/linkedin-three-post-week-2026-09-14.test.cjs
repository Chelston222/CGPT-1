'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const queue = require('../apps/linkedin-review/queue.json');
const curated = require('../apps/linkedin-review/qa-replenishment-2026-09-14-three-post-week-v1.json');
const { validateWeeklyBatch } = require('../scripts/linkedin-week-batch.cjs');

const ENV = {
  BUFFER_API_KEY: 'test-key',
  BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID: 'personal-id',
  BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID: 'main-id',
  BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID: 'secondary-id',
};

function approvalBody() {
  return [
    `BATCH_ID: ${curated.batchId}`,
    `WEEK_START: ${curated.weekStart}`,
    `QUEUE_SCHEMA: ${queue.schemaVersion}`,
    `QUEUE_GENERATED_AT: ${queue.generatedAt}`,
    `APPROVED_ITEMS: ${curated.posts.map((post) => `${post.id}@${post.revision}`).join(',')}`,
  ].join('\n');
}

test('curated Sep 14 week is exactly 21 personal placements at three per day', () => {
  const batch = validateWeeklyBatch(approvalBody(), queue, ENV, Date.parse('2026-09-08T08:45:00Z'));
  assert.equal(batch.weekStart, '2026-09-14');
  assert.equal(batch.weekEnd, '2026-09-20');
  assert.equal(batch.jobs.length, 21);

  const placements = Object.entries(batch.placementsByDay)
    .sort(([a], [b]) => a.localeCompare(b));

  assert.deepEqual(placements.map(([date]) => date), [
    '2026-09-14',
    '2026-09-15',
    '2026-09-16',
    '2026-09-17',
    '2026-09-18',
    '2026-09-19',
    '2026-09-20',
  ]);
  for (const [date, count] of placements) {
    assert.equal(count, 3, `${date} should contain exactly three account placements`);
  }

  for (const job of batch.jobs) {
    assert.deepEqual(job.post.targets, ['personal']);
  }

  const times = curated.posts.map((post) => post.scheduledAt.personal.slice(11, 16));
  assert.deepEqual([...new Set(times)].sort(), ['08:15', '13:15', '18:15']);
});

test('curated Sep 14 week remains review-only until owner approval', () => {
  for (const post of curated.posts) {
    assert.equal(post.status, 'review');
    assert.equal(post.qa.status, 'ready_for_human_review');
    assert.equal(post.qa.approvalEligible, true);
    assert.equal(post.qa.publishPermission, false);
    assert.equal(post.revision, 1);
  }
});

test('curated Sep 14 week contains no em dashes and no duplicate exact copy', () => {
  const copies = curated.posts.map((post) => post.copy.default);
  assert.equal(copies.some((copy) => copy.includes('—')), false);
  assert.equal(new Set(copies).size, copies.length);
});
