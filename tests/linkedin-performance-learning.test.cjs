'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../scripts/linkedin-performance-learning.cjs');

test('parses Buffer analytics comments', () => {
  const parsed = engine.parseAnalyticsComment(`📊 Buffer post-level analytics captured.\n- Buffer post ID: \`abc123\`\n- Metrics refreshed: **2026-08-20T09:30:42.640Z**\n- Reactions: **4**\n- Comments: **1**\n- Eng. Rate: **5.41**%\n- Impressions: **74**\n- Reach: **40**\n<!-- LINKEDIN_ANALYTICS_CAPTURED bufferId=abc123 metricsUpdatedAt=2026-08-20T09:30:42.640Z -->`);
  assert.equal(parsed.bufferId, 'abc123');
  assert.equal(parsed.metrics.engagementRate, 5.41);
  assert.equal(parsed.metrics.reactions, 4);
  assert.equal(parsed.metrics.comments, 1);
  assert.equal(parsed.metrics.impressions, 74);
  assert.equal(parsed.metrics.reach, 40);
});

test('detects founder, contrarian and diagnostic traits', () => {
  const traits = engine.inferTraits(`I caught myself relying on memory.\n\nI thought I would remember. But I didn't.\n\nWhat happened next? Why did it fail?`);
  assert.ok(traits.includes('founder_voice'));
  assert.ok(traits.includes('contrarian'));
  assert.ok(traits.includes('diagnostic'));
  assert.ok(traits.includes('story'));
});

test('shrinks small samples and ranks stronger performance above weak performance', () => {
  const records = [
    { id: 'winner', category: 'founder', format: 'text', traits: ['founder_voice'], metrics: { reactions: 4, comments: 0, engagementRate: 5.41, impressions: 74, reach: 40 } },
    { id: 'weak', category: 'generic', format: 'text', traits: ['more_leads_frame'], metrics: { reactions: 0, comments: 0, engagementRate: 0, impressions: 47, reach: 29 } },
    { id: 'tiny', category: 'diagnostic', format: 'text', traits: ['diagnostic'], metrics: { reactions: 3, comments: 0, engagementRate: 10, impressions: 10, reach: 8 } },
  ];
  const model = engine.buildPerformanceModel(records);
  const winner = model.scored.find((row) => row.id === 'winner');
  const weak = model.scored.find((row) => row.id === 'weak');
  const tiny = model.scored.find((row) => row.id === 'tiny');
  assert.ok(winner.score > weak.score);
  assert.ok(tiny.shrunkEngagement < 10, 'tiny sample should be shrunk toward the baseline');
});

test('candidate scoring prefers traits/categories with better observed evidence', () => {
  const records = [
    { id: 'a', category: 'founder', format: 'text', traits: ['founder_voice', 'story'], hourBucket: '15', metrics: { reactions: 4, comments: 0, engagementRate: 5.4, impressions: 100, reach: 60 } },
    { id: 'b', category: 'generic', format: 'text', traits: ['more_leads_frame'], hourBucket: '12', metrics: { reactions: 0, comments: 0, engagementRate: 0, impressions: 100, reach: 60 } },
  ];
  const model = engine.buildPerformanceModel(records);
  const good = engine.scoreCandidate({ id: 'good', category: 'founder', format: 'text', hourBucket: '15', copy: { default: 'I caught myself doing this again. I noticed it. Then I changed it.' } }, model);
  const bad = engine.scoreCandidate({ id: 'bad', category: 'generic', format: 'text', hourBucket: '12', copy: { default: 'Maybe you need more leads.' } }, model);
  assert.ok(good.candidateScore > bad.candidateScore);
});

test('diverse selection penalises category repetition', () => {
  const selected = engine.selectDiverseCandidates([
    { id: 'a', category: 'same', traits: ['diagnostic'], candidateScore: 90 },
    { id: 'b', category: 'same', traits: ['diagnostic'], candidateScore: 88 },
    { id: 'c', category: 'different', traits: ['story'], candidateScore: 80 },
  ], 2);
  assert.deepEqual(selected.map((x) => x.id), ['a', 'c']);
});

test('commercial outcomes can outrank stronger vanity engagement', () => {
  const comments = [{ body: '<!-- LINKEDIN_COMMERCIAL_SIGNAL bufferId=buyer type=paid valueGbp=595 -->' }];
  const signals = engine.extractCommercialSignals(comments);
  const records = [
    { id: 'vanity', category: 'reach', format: 'text', traits: ['story'], metrics: { reactions: 8, comments: 2, engagementRate: 8, impressions: 200, reach: 150 }, commercialSignals: signals.get('vanity') || [] },
    { id: 'buyer', category: 'offer', format: 'text', traits: ['cta'], metrics: { reactions: 1, comments: 0, engagementRate: 1, impressions: 80, reach: 50 }, commercialSignals: signals.get('buyer') || [] },
  ];
  const scored = engine.buildPerformanceModel(records).scored;
  assert.ok(scored.find((r) => r.id === 'buyer').score > scored.find((r) => r.id === 'vanity').score);
});
