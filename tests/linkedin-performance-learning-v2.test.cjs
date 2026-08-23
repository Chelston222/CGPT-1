'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../scripts/linkedin-performance-learning-v2.cjs');
const policy = require('../apps/linkedin-review/performance-policy.json');

const NOW = Date.parse('2026-08-23T20:00:00Z');

test('rejects analytics that predate publication and accepts mature verified snapshots', () => {
  const placement = { bufferId: 'b1', dueAt: '2026-08-21T12:00:00Z' };
  const verifiedIds = new Set(['b1']);
  const stale = engine.analyticsEligibility({
    placement,
    measured: { updatedAt: '2026-08-21T11:59:00Z', metrics: { reactions: 1 } },
    verifiedIds,
    now: NOW,
    policy,
  });
  assert.equal(stale.eligible, false);
  assert.equal(stale.reason, 'analytics_predates_publication');

  const mature = engine.analyticsEligibility({
    placement,
    measured: { updatedAt: '2026-08-21T12:15:00Z', metrics: { reactions: 1, impressions: 50 } },
    verifiedIds,
    now: NOW,
    policy,
  });
  assert.equal(mature.eligible, true);
});

test('rejects analytics for a post younger than the maturity window', () => {
  const placement = { bufferId: 'b2', dueAt: '2026-08-23T12:00:00Z' };
  const result = engine.analyticsEligibility({
    placement,
    measured: { updatedAt: '2026-08-23T13:00:00Z', metrics: { impressions: 100 } },
    verifiedIds: new Set(['b2']),
    now: NOW,
    policy,
  });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'analytics_immature');
});

test('recency weighting gives newer evidence more influence', () => {
  const recent = engine.recencyWeight('2026-08-22T20:00:00Z', NOW, 28);
  const old = engine.recencyWeight('2026-06-25T20:00:00Z', NOW, 28);
  assert.ok(recent > old);
  assert.ok(recent > 0.9);
  assert.ok(old < 0.3);
});

test('hierarchical candidate scoring blends local and global evidence rather than flipping at three records', () => {
  const globalModel = {
    categories: [{ key: 'founder', adjustedScore: 70 }],
    traits: [{ key: 'founder_voice', adjustedScore: 70 }],
    formats: [{ key: 'text', adjustedScore: 60 }],
    hours: [{ key: '08', adjustedScore: 60 }],
    weekdays: [{ key: 'Mon', adjustedScore: 60 }],
    slots: [{ key: 'Mon-08', adjustedScore: 60 }],
  };
  const localModel = {
    categories: [{ key: 'founder', adjustedScore: 30 }],
    traits: [{ key: 'founder_voice', adjustedScore: 30 }],
    formats: [{ key: 'text', adjustedScore: 40 }],
    hours: [{ key: '08', adjustedScore: 40 }],
    weekdays: [{ key: 'Mon', adjustedScore: 40 }],
    slots: [{ key: 'Mon-08', adjustedScore: 40 }],
  };
  const candidate = { category: 'founder', format: 'text', traits: ['founder_voice'], hourBucket: '08', weekdayBucket: 'Mon', slotBucket: 'Mon-08' };
  const few = engine.scoreCandidateHierarchical(candidate, globalModel, localModel, 3, policy);
  const many = engine.scoreCandidateHierarchical(candidate, globalModel, localModel, 20, policy);
  assert.ok(few.candidateScore > many.candidateScore, 'three local records should not overpower broader evidence');
  assert.ok(few.localEvidenceWeight < 0.5);
  assert.equal(many.localEvidenceWeight, 1);
});

test('fatigue penalty down-ranks near-duplicate recent copy and repeated categories', () => {
  const candidate = {
    candidateScore: 70,
    category: 'rebooking',
    traits: ['customer_state'],
    copy: { default: 'A client can love the service and still forget to rebook. The system should make returning easy.' },
  };
  const recent = [
    { category: 'rebooking', traits: ['customer_state'], copy: 'A client can love the service and still forget to rebook. The system should make returning easy.' },
    { category: 'rebooking', traits: ['customer_state'], copy: 'Rebooking should not rely on memory.' },
    { category: 'rebooking', traits: ['customer_state'], copy: 'A useful return reminder should arrive at the right time.' },
  ];
  const adjusted = engine.applyFatiguePenalty(candidate, recent, policy);
  assert.ok(adjusted.candidateScore < candidate.candidateScore);
  assert.ok(adjusted.fatiguePenalty > 0);
  assert.equal(adjusted.maxRecentSimilarity, 1);
});

test('quality floor preserves empty capacity rather than forcing weak posts', () => {
  assert.equal(engine.passesCandidateFloor({ candidateScore: 47 }, 'EXPLOIT', policy), false);
  assert.equal(engine.passesCandidateFloor({ candidateScore: 48 }, 'EXPLOIT', policy), true);
  assert.equal(engine.passesCandidateFloor({ candidateScore: 45 }, 'EXPLORE', policy), true);
});
