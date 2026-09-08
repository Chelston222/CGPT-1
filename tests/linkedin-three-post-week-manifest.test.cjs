'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const curated = require('../apps/linkedin-review/qa-replenishment-2026-09-14-three-post-week-v1.json');
const queue = require('../apps/linkedin-review/queue.json');

const manifestPath = path.join(__dirname, '..', 'apps', 'linkedin-review', 'approval-ready-2026-09-14-three-post-week-v1.txt');
const manifest = fs.readFileSync(manifestPath, 'utf8');

function header(name) {
  const match = manifest.match(new RegExp(`^${name}:\\s*(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

test('review-ready manifest locks the exact current queue and all 21 curated revisions', () => {
  assert.equal(header('BATCH_ID'), curated.batchId);
  assert.equal(header('WEEK_START'), curated.weekStart);
  assert.equal(Number(header('QUEUE_SCHEMA')), queue.schemaVersion);
  assert.equal(header('QUEUE_GENERATED_AT'), queue.generatedAt);
  assert.equal(header('STATE'), 'REVIEW READY');

  const expected = curated.posts.map((post) => `${post.id}@${post.revision}`).join(',');
  assert.equal(header('ITEMS'), expected);
});
