'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { promotionMatchesQueue } = require('../scripts/linkedin-qa-bank-audit.cjs');

function record() {
  return {
    id: 'tte-learning-v2-secondary-01',
    revision: 1,
    title: 'Lesson: event vs customer state',
    category: 'customer_state',
    contentRole: 'teaching',
    funnelStage: 'education',
    format: 'text',
    targets: ['secondary'],
    mode: 'schedule',
    scheduledAt: { secondary: '2026-09-07T12:45:00+01:00' },
    taxonomy: { category: 'Lifecycle Foundations', season: 'Season 1', lesson_or_resource: 'Lesson 07' },
    copy: { default: 'A sufficiently long governed test copy for the exact promotion contract. This sentence exists only to represent structured equality and does not enter production.' },
    sourceType: 'performance_learning_v2',
    status: 'review',
    qa: { status: 'ready_for_human_review', publishable: true, approvalEligible: true, publishPermission: false },
  };
}

test('allows an exact QA record promoted into the locked queue', () => {
  assert.equal(promotionMatchesQueue(record(), structuredClone(record())), true);
});

test('fails a promoted record when copy drifts', () => {
  const queued = record();
  queued.copy.default += ' Changed.';
  assert.equal(promotionMatchesQueue(record(), queued), false);
});

test('fails a promoted record when target, schedule or revision drifts', () => {
  const target = record();
  target.targets = ['main'];
  assert.equal(promotionMatchesQueue(record(), target), false);

  const schedule = record();
  schedule.scheduledAt.secondary = '2026-09-07T13:45:00+01:00';
  assert.equal(promotionMatchesQueue(record(), schedule), false);

  const revision = record();
  revision.revision = 2;
  assert.equal(promotionMatchesQueue(record(), revision), false);
});
