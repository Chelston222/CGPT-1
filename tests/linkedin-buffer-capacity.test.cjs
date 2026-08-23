'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  acceptedMarker,
  classifyBufferFailure,
  parseAcceptedMarkers,
  planCapacityWindow,
  validateCadenceContract,
  validateDailyPlacementLimit,
} = require('../scripts/linkedin-buffer-capacity.cjs');

function job(id, channels, mode = 'schedule') {
  return {
    post: { id, revision: 1 },
    request: { mode, channels: channels.map(([target, dueAt]) => ({ target, dueAt })) },
  };
}

test('enforces current three-account daily cadence while retaining broad capacity guard', () => {
  const valid = [
    job('personal-core', [['personal', '2026-08-17T08:00:00Z']]),
    job('personal-bonus', [['personal', '2026-08-17T16:00:00Z']]),
    job('main', [['main', '2026-08-17T09:00:00Z']]),
    job('secondary', [['secondary', '2026-08-17T10:00:00Z']]),
  ];
  assert.equal(validateDailyPlacementLimit(valid)['2026-08-17'], 4);
  assert.throws(() => validateDailyPlacementLimit([...valid, job('personal-third', [['personal', '2026-08-17T18:00:00Z']])]), /new cadence maximum is 2 per day/);
  assert.throws(() => validateDailyPlacementLimit([...valid, job('main-second', [['main', '2026-08-17T18:00:00Z']])]), /new cadence maximum is 1 per day/);
});

test('enforces weekly company and Retention School ceilings', () => {
  const main = Array.from({ length: 5 }, (_, index) => job(`main-${index}`, [['main', `2026-08-${17 + index}T09:00:00Z`]]));
  assert.doesNotThrow(() => validateCadenceContract(main));
  assert.throws(() => validateCadenceContract([...main, job('main-six', [['main', '2026-08-23T09:00:00Z']])]), /maximum is 5 per week/);

  const school = Array.from({ length: 5 }, (_, index) => job(`school-${index}`, [['secondary', `2026-08-${17 + index}T10:00:00Z`]]));
  assert.doesNotThrow(() => validateCadenceContract(school));
  assert.throws(() => validateCadenceContract([...school, job('school-six', [['secondary', '2026-08-23T10:00:00Z']])]), /maximum is 5 per week/);
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

test('non-public drafts bypass scheduled queue capacity and cadence limits', () => {
  const draft = job('draft-canary', [['personal', null]], 'draft');
  const plan = planCapacityWindow([draft], { personal: 10, main: 10, secondary: 10 });
  assert.deepEqual(plan.dispatch.map((item) => item.key), ['draft-canary@1:personal']);
  assert.equal(plan.waiting.length, 0);
  assert.deepEqual(validateDailyPlacementLimit([draft]), {});
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
