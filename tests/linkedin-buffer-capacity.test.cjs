'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  acceptedMarker,
  classifyBufferFailure,
  parseAcceptedMarkers,
  planCapacityWindow,
  validateDailyPlacementLimit,
} = require('../scripts/linkedin-buffer-capacity.cjs');

function job(id, channels) {
  return {
    post: { id, revision: 1 },
    request: { channels: channels.map(([target, dueAt]) => ({ target, dueAt })) },
  };
}

test('allows fifteen total placements but no more than five on one channel per day', () => {
  const jobs = ['personal', 'main', 'secondary'].flatMap((target) =>
    Array.from({ length: 5 }, (_, index) => job(`${target}-${index}`, [[target, '2026-08-17T08:00:00Z']])),
  );
  assert.equal(validateDailyPlacementLimit(jobs)['2026-08-17'], 15);
  assert.throws(() => validateDailyPlacementLimit([...jobs, job('overflow', [['personal', '2026-08-17T12:00:00Z']])]), /maximum is 15/);
  assert.throws(() => validateDailyPlacementLimit([
    ...jobs.filter((entry) => !entry.post.id.startsWith('secondary-')),
    job('personal-six', [['personal', '2026-08-17T12:00:00Z']]),
  ]), /maximum is 5 per channel/);
});

test('counts a multi-channel post once per destination', () => {
  const jobs = [job('flagship', [
    ['personal', '2026-08-17T08:00:00Z'],
    ['main', '2026-08-17T09:00:00Z'],
    ['secondary', '2026-08-17T10:00:00Z'],
  ])];
  assert.equal(validateDailyPlacementLimit(jobs)['2026-08-17'], 3);
});

test('plans only free Buffer slots and preserves chronological order', () => {
  const jobs = [
    job('later', [['personal', '2026-08-18T08:00:00Z']]),
    job('first', [['personal', '2026-08-17T08:00:00Z'], ['main', '2026-08-17T09:00:00Z']]),
  ];
  const plan = planCapacityWindow(jobs, { personal: 9, main: 10, secondary: 0 });
  assert.deepEqual(plan.dispatch.map((item) => item.key), ['first@1:personal']);
  assert.deepEqual(plan.waiting.map((item) => item.key), ['first@1:main', 'later@1:personal']);
});

test('accepted audit markers make retries idempotent', () => {
  const marker = acceptedMarker('first@1:personal');
  const accepted = parseAcceptedMarkers([{ body: `Accepted\n${marker}`, user: { login: 'github-actions[bot]' } }]);
  const plan = planCapacityWindow([job('first', [['personal', '2026-08-17T08:00:00Z']])], {}, accepted);
  assert.equal(plan.dispatch.length, 0);
  assert.equal(plan.alreadyAccepted.length, 1);
});

test('ignores acceptance markers forged by a human commenter', () => {
  const marker = acceptedMarker('first@1:personal');
  assert.equal(parseAcceptedMarkers([{ body: marker, user: { login: 'someone-else' } }]).size, 0);
});

test('counts Buffer UTC due times on the Europe/London calendar date', () => {
  const nearMidnight = job('midnight', [['personal', '2026-08-16T23:30:00Z']]);
  assert.equal(validateDailyPlacementLimit([nearMidnight])['2026-08-17'], 1);
});

test('classifies retryable and manual-intervention failures', () => {
  assert.deepEqual(classifyBufferFailure({ status: 429, messages: ['limit'] }).code, 'rate_limited');
  assert.equal(classifyBufferFailure({ status: 503, messages: [] }).retryable, true);
  assert.equal(classifyBufferFailure({ messages: ['lost authorization'] }).retryable, false);
  assert.equal(classifyBufferFailure({ messages: ['document title missing'] }).code, 'media_rejected');
});
