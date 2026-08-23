'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_POLICY, evaluateSupply } = require('../scripts/linkedin-content-supply.cjs');

const NOW = Date.parse('2026-08-23T12:00:00Z');

function post(id, target, dueAt, sourceType = 'performance_learning_v2') {
  return {
    id,
    title: id,
    category: 'test',
    targets: [target],
    scheduledAt: { [target]: dueAt },
    sourceType,
    status: 'review',
    qa: { status: 'ready_for_human_review', approvalEligible: true, publishPermission: false },
  };
}

test('current-policy future review posts satisfy supply while legacy posts do not', () => {
  const posts = [
    ...Array.from({ length: 14 }, (_, i) => post(`p-${i}`, 'personal', `2026-09-${String(7 + (i % 7)).padStart(2, '0')}T12:00:00Z`)),
    ...Array.from({ length: 10 }, (_, i) => post(`m-${i}`, 'main', `2026-09-${String(7 + (i % 7)).padStart(2, '0')}T12:00:00Z`)),
    ...Array.from({ length: 10 }, (_, i) => post(`s-${i}`, 'secondary', `2026-09-${String(7 + (i % 7)).padStart(2, '0')}T12:00:00Z`)),
    post('legacy', 'personal', '2026-09-09T12:00:00Z', 'qa_weekly_replenishment'),
  ];
  const result = evaluateSupply(posts, new Set(), NOW, DEFAULT_POLICY);
  assert.equal(result.green, true);
  assert.equal(result.targets.personal.currentCount, 14);
  assert.equal(result.targets.personal.legacyCount, 1);
});

test('reserved posts are excluded from future supply', () => {
  const posts = Array.from({ length: 14 }, (_, i) => post(`p-${i}`, 'personal', '2026-09-07T12:00:00Z'));
  const result = evaluateSupply(posts, new Set(['p-0', 'p-1']), NOW, DEFAULT_POLICY);
  assert.equal(result.targets.personal.currentCount, 12);
  assert.equal(result.targets.personal.gap, 2);
  assert.equal(result.green, false);
});

test('expired and non-review-ready posts cannot satisfy reserve', () => {
  const expired = post('expired', 'personal', '2026-08-20T12:00:00Z');
  const unsafe = post('unsafe', 'personal', '2026-09-07T12:00:00Z');
  unsafe.qa.publishPermission = true;
  const result = evaluateSupply([expired, unsafe], new Set(), NOW, DEFAULT_POLICY);
  assert.equal(result.targets.personal.currentCount, 0);
  assert.equal(result.targets.personal.expired.length, 1);
});

test('supply is grouped by future Monday week for operational planning', () => {
  const result = evaluateSupply([
    post('a', 'main', '2026-09-07T12:00:00Z'),
    post('b', 'main', '2026-09-09T12:00:00Z'),
    post('c', 'main', '2026-09-14T12:00:00Z'),
  ], new Set(), NOW, DEFAULT_POLICY);
  assert.equal(result.targets.main.byWeek['2026-09-07'], 2);
  assert.equal(result.targets.main.byWeek['2026-09-14'], 1);
});
