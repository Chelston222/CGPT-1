'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'apps/linkedin-review/app.js'), 'utf8');
const sync = fs.readFileSync(path.join(root, 'apps/linkedin-review/sync.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'apps/linkedin-review/index.html'), 'utf8');
const fn = fs.readFileSync(path.join(root, 'apps/linkedin-review/netlify/functions/review-decisions.mjs'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/package.json'), 'utf8'));

test('cross-device sync loads after the existing Swiper', () => {
  assert.match(html, /<script src="app\.js" defer><\/script>\s*<script src="sync\.js" defer><\/script>/);
});

test('review sync never replaces the owner-authenticated GitHub publishing gate', () => {
  assert.match(app, /\[APPROVED LINKEDIN WEEK\]/);
  assert.doesNotMatch(sync, /api\.buffer\.com|createPost\s*\(/);
  assert.match(sync, /still not permission to publish/i);
});

test('remote decisions are authenticated and revision-aware', () => {
  assert.match(fn, /REVIEW_SYNC_TOKEN/);
  assert.match(fn, /x-review-sync-key/);
  assert.match(fn, /Number\.isInteger\(revision\)/);
  assert.match(fn, /ALLOWED_DECISIONS/);
  assert.match(sync, /Number\(decision\.revision\) === Number\(post\.revision\)/);
});

test('remote decision state uses strong-consistency Netlify Blobs', () => {
  assert.equal(pkg.dependencies['@netlify/blobs'], '10.7.10');
  assert.match(fn, /getStore\(STORE_NAME, \{ consistency: 'strong' \}\)/);
  assert.match(fn, /path: '\/api\/review-decisions'/);
});

test('local review continues safely when sync is unavailable', () => {
  assert.match(sync, /originalSaveDecisions\(\)/);
  assert.match(sync, /Your choice is still safely saved on this device/i);
  assert.match(sync, /Local review choices remain available/i);
});
