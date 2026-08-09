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

test('enforces ten total account placements per calendar day', () => {
  const jobs = Array.from({ length: 10 }, (_, index) => job(`p-${index}`, [['personal', '2026-08-17T08:00:00Z']]));
  assert.equal(validateDailyPlacementLimit(jobs)['2026-08-17'], 10);
  assert.throws(() => validateDailyPlacementLimit([...jobs, job('overflow', [['main', '2026-08-17T12:00:00Z']])]), /maximum is 10/);
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
  const accepted = parseAcceptedMarkers([{ body: `Accepted\n${marker}` }]);
  const plan = planCapacityWindow([job('first', [['personal', '2026-08-17T08:00:00Z']])], {}, accepted);
  assert.equal(plan.dispatch.length, 0);
  assert.equal(plan.alreadyAccepted.length, 1);
});

test('classifies retryable and manual-intervention failures', () => {
  assert.deepEqual(classifyBufferFailure({ status: 429, messages: ['limit'] }).code, 'rate_limited');
  assert.equal(classifyBufferFailure({ status: 503, messages: [] }).retryable, true);
  assert.equal(classifyBufferFailure({ messages: ['lost authorization'] }).retryable, false);
  assert.equal(classifyBufferFailure({ messages: ['document title missing'] }).code, 'media_rejected');
});
