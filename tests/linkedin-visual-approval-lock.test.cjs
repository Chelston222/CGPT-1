'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('incorrect Retention School launch assets are retired', () => {
  const root = path.join(__dirname, '..');
  assert.equal(fs.existsSync(path.join(root, 'apps/linkedin-review/media/retention-school-launch.svg')), false);
  assert.equal(fs.existsSync(path.join(root, 'apps/linkedin-review/media/retention-school-launch-4k.png')), false);
  const source = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/qa-replenishment-2026-08-25-retention-school.json'), 'utf8'));
  assert.equal(source.schemaVersion, 1);
  assert.deepEqual(source.posts, []);
});

test('visual approval policy distinguishes safe-zone QA from exact asset approval', () => {
  const policy = fs.readFileSync(path.join(__dirname, '..', 'docs/LINKEDIN_VISUAL_APPROVAL_LOCK.md'), 'utf8');
  assert.match(policy, /SAFE_ZONE_QA is not visual approval/);
  assert.match(policy, /exact asset shown to and approved by the owner/i);
  assert.match(policy, /byte count and SHA-256/);
  assert.match(policy, /fail-closed/i);
});
