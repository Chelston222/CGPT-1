'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const wave1Path = path.join(root, 'apps/linkedin-review/qa-replenishment-2026-08-22.json');
const wave2Path = path.join(root, 'apps/linkedin-review/qa-replenishment-2026-08-22-rr14-wave2.json');
const loader = fs.readFileSync(path.join(root, 'scripts/linkedin-week-batch.cjs'), 'utf8');
const wave1 = JSON.parse(fs.readFileSync(wave1Path, 'utf8'));
const wave2 = JSON.parse(fs.readFileSync(wave2Path, 'utf8'));
const posts = [...wave1.posts, ...wave2.posts];

test('RR14 contains exactly 42 unique locked posts, 14 per channel', () => {
  assert.equal(posts.length, 42);
  assert.equal(new Set(posts.map((post) => post.id)).size, 42);
  for (const target of ['personal', 'main', 'secondary']) {
    assert.equal(posts.filter((post) => post.targets.length === 1 && post.targets[0] === target).length, 14, target);
  }
});

test('every RR14 record is owner-review locked and non-publishable without approval', () => {
  for (const post of posts) {
    assert.equal(post.revision, 1, post.id);
    assert.equal(post.status, 'review', post.id);
    assert.equal(post.sourceType, 'qa_replenishment', post.id);
    assert.equal(post.qa?.status, 'ready_for_human_review', post.id);
    assert.equal(post.qa?.approvalEligible, true, post.id);
    assert.equal(post.qa?.publishPermission, false, post.id);
    assert.equal(post.mode, 'schedule', post.id);
    assert.equal(post.format, 'text', post.id);
    assert.ok(post.copy?.default?.trim(), post.id);
  }
});

test('RR14 copy passes core brand and truth-safety static checks', () => {
  for (const post of posts) {
    const copy = post.copy.default;
    assert.doesNotMatch(copy, /—/, `${post.id} contains an em dash`);
    assert.doesNotMatch(copy, /\bFit Check\b/i, `${post.id} regressed to Fit Check wording`);
    assert.doesNotMatch(copy, /\$\d/, `${post.id} contains dollar-denominated copy`);
    assert.doesNotMatch(copy, /\b222 Emails\b/, `${post.id} uses the spaced brand name`);
  }
});

test('RR14 has no exact duplicate post copy', () => {
  const normalised = posts.map((post) => post.copy.default.replace(/\s+/g, ' ').trim().toLowerCase());
  assert.equal(new Set(normalised).size, posts.length);
});

test('RR14 schedules are present, parseable and stay within per-channel daily placement limits', () => {
  const counts = new Map();
  for (const post of posts) {
    const target = post.targets[0];
    const due = post.scheduledAt?.[target];
    assert.ok(due, post.id);
    assert.ok(Number.isFinite(Date.parse(due)), post.id);
    const date = due.slice(0, 10);
    const key = `${date}:${target}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const [key, count] of counts) assert.ok(count <= 5, `${key} has ${count} placements`);
});

test('current locked-queue loader discovers QA replenishment files dynamically, including both RR14 waves', () => {
  assert.match(loader, /readdirSync\(QA_REPLENISHMENT_DIR\)/);
  assert.match(loader, /\^qa-replenishment-\.\*\\\.json\$/);
  assert.match(loader, /withQaReplenishment/);
  assert.ok(fs.existsSync(wave1Path));
  assert.ok(fs.existsSync(wave2Path));
});
