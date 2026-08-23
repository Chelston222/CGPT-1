'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseItems, qaReplenishmentPaths, validateWeeklyBatch, withQaReplenishment } = require('../scripts/linkedin-week-batch.cjs');

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
  assert.equal(batch.jobs[0].request.contentQa, 'pass');
});

test('fails the whole preflight when the queue or a revision changed', () => {
  assert.throws(() => validateWeeklyBatch(body({ generatedAt: 'older' }), queue, ENV), /queue changed/);
  assert.throws(() => validateWeeklyBatch(body({ items: 'tte-li-001@2' }), queue, ENV), /changed revision/);
});

test('capacity retries tolerate queue regeneration only while revisions remain locked', () => {
  const regenerated = { ...queue, generatedAt: '2026-08-10T08:00:00+01:00' };
  assert.equal(validateWeeklyBatch(body(), regenerated, ENV, Date.parse('2026-08-09T00:00:00Z'), { allowGeneratedAtDrift: true }).jobs.length, 2);
  const changed = { ...regenerated, posts: [{ ...queue.posts[0], revision: 4 }, queue.posts[1]] };
  assert.throws(() => validateWeeklyBatch(body(), changed, ENV, Date.parse('2026-08-09T00:00:00Z'), { allowGeneratedAtDrift: true }), /changed revision/);
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

test('fails closed instead of sending a carousel as a text-only post', () => {
  const carouselQueue = {
    ...queue,
    posts: [{
      ...queue.posts[0],
      format: 'carousel',
      mediaUrl: '',
      carousel: { libraryId: '028', slideCount: 6, readiness: 'pdf_required' },
    }],
  };
  assert.throws(
    () => validateWeeklyBatch(body({ items: 'tte-li-001@3' }), carouselQueue, ENV, Date.parse('2026-08-09T00:00:00Z')),
    /carousel PDF and public thumbnail are not verified and publishable/,
  );
});

test('weekly image posts require an explicit safe-zone pass on the exact queue revision', () => {
  const imagePost = {
    ...queue.posts[0],
    format: 'image',
    mediaUrl: 'https://example.com/visual.png',
    mediaAlt: 'Revenue recovery visual',
  };
  const unsafe = { ...queue, posts: [imagePost] };
  assert.throws(
    () => validateWeeklyBatch(body({ items: 'tte-li-001@3' }), unsafe, ENV, Date.parse('2026-08-09T00:00:00Z')),
    /missing an explicit safe-zone QA pass/,
  );

  const safe = { ...queue, posts: [{ ...imagePost, safeZoneQa: 'PASS' }] };
  const result = validateWeeklyBatch(body({ items: 'tte-li-001@3' }), safe, ENV, Date.parse('2026-08-09T00:00:00Z'));
  assert.equal(result.jobs[0].request.safeZoneQa, 'pass');
});

test('accepts the current maximum strategic cadence of 24 placements per week', () => {
  const posts = [];
  for (let day = 0; day < 7; day += 1) {
    const date = 17 + day;
    posts.push({
      id: `personal-a-${day}`, revision: 1, category: 'education', mode: 'schedule', targets: ['personal'],
      scheduledAt: { personal: `2026-08-${String(date).padStart(2, '0')}T08:15:00+01:00` }, copy: { default: `Personal A ${day}` },
    });
    posts.push({
      id: `personal-b-${day}`, revision: 1, category: 'education', mode: 'schedule', targets: ['personal'],
      scheduledAt: { personal: `2026-08-${String(date).padStart(2, '0')}T16:15:00+01:00` }, copy: { default: `Personal B ${day}` },
    });
  }
  for (let day = 0; day < 5; day += 1) {
    const date = 17 + day;
    posts.push({
      id: `main-${day}`, revision: 1, category: 'education', mode: 'schedule', targets: ['main'],
      scheduledAt: { main: `2026-08-${String(date).padStart(2, '0')}T09:30:00+01:00` }, copy: { default: `Main ${day}` },
    });
    posts.push({
      id: `secondary-${day}`, revision: 1, category: 'education', mode: 'schedule', targets: ['secondary'],
      scheduledAt: { secondary: `2026-08-${String(date).padStart(2, '0')}T10:45:00+01:00` }, copy: { default: `Secondary ${day}` },
    });
  }
  const strategicQueue = { ...queue, posts };
  const items = posts.map((post) => `${post.id}@1`).join(',');
  const result = validateWeeklyBatch(body({ items }), strategicQueue, ENV, Date.parse('2026-08-09T00:00:00Z'));
  assert.equal(result.jobs.length, 24);
});

test('rejects a third personal placement on one day before Buffer is contacted', () => {
  const posts = Array.from({ length: 3 }, (_, index) => ({
    id: `personal-${index}`, revision: 1, category: 'education', mode: 'schedule',
    targets: ['personal'], scheduledAt: { personal: `2026-08-17T${String(8 + index * 4).padStart(2, '0')}:15:00+01:00` },
    copy: { default: `Useful post ${index}` },
  }));
  const overloaded = { ...queue, posts };
  assert.throws(
    () => validateWeeklyBatch(body({ items: posts.map((post) => `${post.id}@1`).join(',') }), overloaded, ENV, Date.parse('2026-08-09T00:00:00Z')),
    /new cadence maximum is 2 per day/,
  );
});

test('rejects a second Main 222Emails placement on one day before Buffer is contacted', () => {
  const posts = Array.from({ length: 2 }, (_, index) => ({
    id: `main-over-${index}`, revision: 1, category: 'education', mode: 'schedule',
    targets: ['main'], scheduledAt: { main: `2026-08-17T${String(9 + index * 4).padStart(2, '0')}:30:00+01:00` },
    copy: { default: `Main post ${index}` },
  }));
  const overloaded = { ...queue, posts };
  assert.throws(
    () => validateWeeklyBatch(body({ items: posts.map((post) => `${post.id}@1`).join(',') }), overloaded, ENV, Date.parse('2026-08-09T00:00:00Z')),
    /new cadence maximum is 1 per day/,
  );
});

test('future QA banks are discovered automatically but remain review-only until explicit approval', () => {
  const paths = qaReplenishmentPaths();
  assert.ok(paths.some((file) => file.endsWith('qa-replenishment-2026-09-07-learning-v2.json')));
  const effective = withQaReplenishment({ schemaVersion: 2, generatedAt: queue.generatedAt, posts: [] });
  const post = effective.posts.find((item) => item.id === 'tte-learning-v2-personal-01');
  assert.ok(post);
  assert.equal(post.status, 'review');
  assert.equal(post.qa.approvalEligible, true);
  assert.equal(post.qa.publishPermission, false);
});

test('an explicitly approved future QA item can pass the canonical weekly gate without inline issue copy', () => {
  const futureQueue = { schemaVersion: 2, generatedAt: queue.generatedAt, posts: [] };
  const futureBody = [
    'BATCH_ID: future-learning-v2-test',
    'WEEK_START: 2026-09-07',
    'QUEUE_SCHEMA: 2',
    `QUEUE_GENERATED_AT: ${queue.generatedAt}`,
    'APPROVED_ITEMS: tte-learning-v2-personal-01@1',
  ].join('\n');
  const result = validateWeeklyBatch(futureBody, futureQueue, ENV, Date.parse('2026-08-23T12:00:00Z'));
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].post.id, 'tte-learning-v2-personal-01');
  assert.equal(result.jobs[0].request.contentQa, 'pass');
});
