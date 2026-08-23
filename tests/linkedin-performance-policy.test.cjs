'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../apps/linkedin-review/performance-policy.json');

test('learning policy protects runway and exploration', () => {
  assert.ok(policy.queueTargetPerChannel < policy.queueMaximumPerChannel);
  assert.equal(policy.queueMaximumPerChannel, 10);
  assert.equal(Number((policy.exploitRatio + policy.adjacentRatio + policy.exploreRatio).toFixed(6)), 1);
  assert.ok(policy.exploreRatio >= 0.1);
});

test('commercial outcomes have material but bounded weight', () => {
  assert.ok(policy.scoring.commercialWeight >= 0.4);
  assert.ok(policy.scoring.commercialWeight <= 0.5);
  assert.ok(policy.minimumSamplesForSuppression >= 3);
});

test('v2 policy refuses stale and immature analytics', () => {
  assert.equal(policy.schemaVersion, 2);
  assert.ok(policy.analyticsMinimumPostAgeHours >= 24);
  assert.ok(policy.analyticsFreshnessAfterDueMinutes >= 5);
  assert.ok(policy.recencyHalfLifeDays >= 14);
});

test('v2 policy protects quality and content freshness', () => {
  assert.ok(policy.minimumCandidateScore > policy.exploreMinimumCandidateScore);
  assert.ok(policy.fatigue.recentLookbackDays >= 7);
  assert.ok(policy.fatigue.similarityThreshold > 0 && policy.fatigue.similarityThreshold < 1);
  assert.ok(policy.localModelFullStrengthRecords > policy.minimumTargetRecordsForLocalModel);
});
