'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { withQaReplenishment } = require('../scripts/linkedin-week-batch.cjs');

const root = path.resolve(__dirname, '..');
const queue = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/queue.json'), 'utf8'));
const qa = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/qa-replenishment-2026-08-11.json'), 'utf8'));
const supplementalFiles = [
  'qa-replenishment-2026-08-11.json',
  'qa-replenishment-2026-08-17.json',
  'qa-replenishment-2026-08-22.json',
  'qa-replenishment-2026-08-22-rr14-wave2.json',
];

test('original QA replenishment still represents one full 15-placement day without inheriting publish permission', () => {
  assert.equal(qa.posts.length, 15);
  const counts = { personal: 0, main: 0, secondary: 0 };
  for (const post of qa.posts) {
    assert.equal(post.status, 'review');
    assert.equal(post.qa.status, 'ready_for_human_review');
    assert.equal(post.qa.approvalEligible, true);
    assert.equal(post.qa.publishPermission, false);
    assert.equal(post.targets.length, 1);
    const target = post.targets[0];
    counts[target] += 1;
    assert.match(post.scheduledAt[target], /^2026-08-12T/);
    assert.ok(post.copy.default.length > 100 && post.copy.default.length <= 3000);
    assert.doesNotMatch(post.copy.default, /—/);
  }
  assert.deepEqual(counts, { personal: 5, main: 5, secondary: 5 });
});

test('effective queue includes every eligible locked supplemental candidate once and leaves canonical queue unchanged', () => {
  const originalCount = queue.posts.length;
  const existingIds = new Set(queue.posts.map((post) => post.id));
  const expectedNewIds = [];
  const seen = new Set(existingIds);
  for (const file of supplementalFiles) {
    const batch = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review', file), 'utf8'));
    for (const post of batch.posts || []) {
      if (
        seen.has(post.id)
        || post.status !== 'review'
        || post.qa?.status !== 'ready_for_human_review'
        || post.qa?.approvalEligible !== true
        || post.qa?.publishPermission !== false
      ) continue;
      seen.add(post.id);
      expectedNewIds.push(post.id);
    }
  }

  const effective = withQaReplenishment(queue);
  assert.equal(queue.posts.length, originalCount);
  assert.equal(effective.posts.length, originalCount + expectedNewIds.length);
  assert.equal(new Set(effective.posts.map((post) => post.id)).size, effective.posts.length);
  assert.ok(effective.posts.some((post) => post.id === 'tte-li-qa-001'));
  assert.ok(effective.posts.some((post) => post.id === 'tte-rr14-personal-14'));
  assert.equal(effective.generatedAt, queue.generatedAt);
});

test('QA batch is based on approved style and recent live crawl metadata', () => {
  assert.equal(qa.sourceBasis.approvedOperationalSet, 'tte-li-001 through tte-li-018');
  assert.ok(qa.sourceBasis.liveCrawl.some((item) => /Missing Client Gaps in Busy Weeks/i.test(item)));
  assert.ok(qa.sourceBasis.rules.includes('fresh human approval required'));
});
