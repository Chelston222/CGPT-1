'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const queue = require('../apps/linkedin-review/queue.json');
const override = require('../apps/linkedin-review/schedule-overrides-2026-09-08-three-post-window-v2.json');

const manifestPath = path.join(__dirname, '..', 'apps', 'linkedin-review', 'approval-ready-2026-09-08-three-post-window-v2.txt');
const manifest = fs.readFileSync(manifestPath, 'utf8');

function header(name) {
  const match = manifest.match(new RegExp(`^${name}:\\s*(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

test('current rolling manifest locks the exact 21 rebased revisions from 8 September', () => {
  assert.equal(header('BATCH_ID'), override.batchId);
  assert.equal(header('WEEK_START'), override.windowStart);
  assert.equal(header('WINDOW_MODE'), 'ROLLING_7_DAY');
  assert.equal(Number(header('QUEUE_SCHEMA')), queue.schemaVersion);
  assert.equal(header('QUEUE_GENERATED_AT'), queue.generatedAt);
  assert.equal(header('STATE'), 'REVIEW READY');

  const expected = override.posts.map((post) => `${post.id}@${post.revision}`).join(',');
  assert.equal(header('ITEMS'), expected);
  assert.equal(override.posts.length, 21);
});

test('current rolling manifest guarantees a full three posts on 8 September', () => {
  const today = override.posts.filter((post) => post.scheduledAt.personal.startsWith('2026-09-08'));
  assert.equal(today.length, 3);
  assert.deepEqual(today.map((post) => post.scheduledAt.personal.slice(11, 16)), ['14:00', '16:15', '18:30']);
});
