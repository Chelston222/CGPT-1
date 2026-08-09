'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseItems, validateWeeklyBatch } = require('../scripts/linkedin-week-batch.cjs');

const ENV = {
  BUFFER_API_KEY: 'test-key',
  BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID: 'personal-id',
  BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID: 'main-id',
  BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID: 'secondary-id',
};

const queue = {
  schemaVersion: 2,
  generatedAt: '2026-08-09T16:30:00+01:00',
  posts: [
    {
      id: 'tte-li-001', revision: 3, category: 'education', mode: 'schedule',
      targets: ['personal'], scheduledAt: { personal: '2026-08-17T08:15:00+01:00' },
      copy: { default: 'Personal copy' },
    },
    {
      id: 'tte-li-002', revision: 1, category: 'proof', mode: 'schedule',
      targets: ['main', 'secondary'],
      scheduledAt: { main: '2026-08-18T09:00:00+01:00', secondary: '2026-08-20T09:00:00+01:00' },
      copy: { default: 'Fallback', main: 'Main angle', secondary: 'Secondary angle' },
    },
  ],
};

function body(overrides = {}) {
  return [
    `BATCH_ID: test-week`,
    `WEEK_START: ${overrides.week || '2026-08-17'}`,
    `QUEUE_SCHEMA: ${overrides.schema || 2}`,
    `QUEUE_GENERATED_AT: ${overrides.generatedAt || queue.generatedAt}`,
    `APPROVED_ITEMS: ${overrides.items || 'tte-li-001@3,tte-li-002@1'}`,
  ].join('\n');
}

test('locks a complete weekly request to queue version and post revisions', () => {
  const batch = validateWeeklyBatch(body(), queue, ENV, Date.parse('2026-08-09T00:00:00Z'));
  assert.equal(batch.weekStart, '2026-08-17');
  assert.equal(batch.weekEnd, '2026-08-23');
  assert.equal(batch.jobs.length, 2);
  assert.equal(batch.jobs[1].request.channels[1].text, 'Secondary angle');
});

test('fails the whole preflight when the queue or a revision changed', () => {
  assert.throws(() => validateWeeklyBatch(body({ generatedAt: 'older' }), queue, ENV), /queue changed/);
  assert.throws(() => validateWeeklyBatch(body({ items: 'tte-li-001@2' }), queue, ENV), /changed revision/);
});

test('fails before dispatch data is returned when any destination secret is missing', () => {
  assert.throws(
    () => validateWeeklyBatch(body(), queue, { ...ENV, BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID: '' }, Date.parse('2026-08-09T00:00:00Z')),
    /BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID/,
  );
});

test('rejects duplicate, unknown and malformed approved items', () => {
  assert.throws(() => parseItems('tte-li-001@3,tte-li-001@3'), /more than once/);
  assert.throws(() => parseItems('tte-li-001'), /post-id@revision/);
  assert.throws(() => validateWeeklyBatch(body({ items: 'tte-li-999@1' }), queue, ENV), /not present/);
});

test('rejects schedules outside the selected Monday-to-Sunday week', () => {
  assert.throws(() => validateWeeklyBatch(body({ week: '2026-08-24' }), queue, ENV), /outside the approved week/);
  assert.throws(() => validateWeeklyBatch(body({ week: '2026-08-18' }), queue, ENV), /must be a Monday/);
});

test('accepts a compact 105-item approval list', () => {
  const largeQueue = {
    ...queue,
    posts: Array.from({ length: 105 }, (_, index) => ({
      id: `post-${String(index + 1).padStart(3, '0')}`,
      revision: 1,
      category: 'education',
      mode: 'schedule',
      targets: ['personal'],
      scheduledAt: { personal: '2026-08-17T08:15:00+01:00' },
      copy: { default: `Useful post ${index + 1}` },
    })),
  };
  const items = largeQueue.posts.map((post) => `${post.id}@1`).join(',');
  const result = validateWeeklyBatch(body({ items }), largeQueue, ENV, Date.parse('2026-08-09T00:00:00Z'));
  assert.equal(result.jobs.length, 105);
});
