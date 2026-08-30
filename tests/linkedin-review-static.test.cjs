'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'apps/linkedin-review/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'apps/linkedin-review/app.js'), 'utf8');
const queue = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/queue.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/ledger-manifest.json'), 'utf8'));
const publicPosts = queue.posts.filter((post) => post.mode === 'schedule');
const draftPosts = queue.posts.filter((post) => post.mode === 'draft');

test('manual Next is labelled as a no-decision action', () => {
  assert.match(html, /id="manual-next"/);
  assert.match(html, /No decision saved/);
});

test('manual Next changes navigation only', () => {
  const body = app.match(/function showNextWithoutDecision\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(body, /state\.index = \(state\.index \+ 1\) % state\.filtered\.length/);
  assert.doesNotMatch(body, /saveDecisions|localStorage|window\.location|openDecision|weeklyIssueUrl|fetch\(/);
});

test('carousel can receive an editorial YES while final dispatch stays guarded', () => {
  assert.doesNotMatch(app, /decision === 'approve' && !carouselIsPublishable\(post\)/);
  assert.match(app, /summary\.yes\.some\(\(post\) => !carouselIsPublishable\(post\)\)/);
  assert.match(app, /awaiting final PDF/);
  const weekly = fs.readFileSync(path.join(root, 'scripts/linkedin-week-batch.cjs'), 'utf8');
  assert.match(weekly, /post\.format === 'carousel'/);
  assert.match(weekly, /carousel PDF and public thumbnail are not verified and publishable/);
});

test('carousel previews use the promoted six-slide render gallery', () => {
  assert.match(html, /class="carousel-gallery"/);
  assert.match(app, /media\/carousels\/\$\{post\.carousel\.libraryId\}\/slide-/);
  assert.match(app, /event\.target\.closest\('\.carousel-gallery'\)/);
});

test('a slow GitHub audit cannot block the review queue indefinitely', () => {
  assert.match(app, /GITHUB_AUDIT_TIMEOUT_MS = 5000/);
  assert.match(app, /controller\.abort\(\)/);
  assert.match(app, /signal: controller\.signal/);
  assert.match(app, /Queue ready · GitHub audit unavailable/);
});

test('Swiper is a checked projection of the Master LinkedIn Ledger', () => {
  assert.equal(queue.masterLedger.id, manifest.ledgerId);
  assert.equal(queue.masterLedger.projection, 'live_ready_human_review');
  assert.equal(manifest.publicProjection.posts, publicPosts.length);
  assert.equal(manifest.rules.newContentEntersMasterFirst, true);
  assert.match(app, /queue\.masterLedger\.id !== ledger\.ledgerId/);
  assert.match(html, /id="master-total"/);
});

test('non-public drafts remain outside the public scheduling projection', () => {
  for (const post of draftPosts) {
    assert.equal(post.mode, 'draft');
    assert.ok(!post.scheduledAt || Object.keys(post.scheduledAt).length === 0, `${post.id} unexpectedly has a public schedule`);
  }
  assert.equal(publicPosts.length + draftPosts.length, queue.posts.length);
});

test('UI distinguishes five daily posts per channel from Buffer Free queue capacity', () => {
  assert.equal(queue.capacityPolicy.maximumPlacementsPerChannelPerDay, 5);
  assert.equal(queue.capacityPolicy.maximumAccountPlacementsPerDay, 15);
  assert.equal(queue.capacityPolicy.maximumAccountPlacementsPerWeek, 105);
  assert.equal(queue.capacityPolicy.bufferFreeScheduledPerChannel, 10);
  const byTarget = Object.fromEntries(['personal', 'main', 'secondary'].map((target) => [
    target,
    publicPosts.filter((post) => post.targets.includes(target)).length,
  ]));
  assert.deepEqual(byTarget, { personal: 10, main: 10, secondary: 10 });
  assert.match(html, /Buffer Free holds 10 scheduled posts per account/);
  assert.match(app, /placements\.length} prepared/);
  assert.match(app, /\$\{count\}\/15/);
});

test('review decisions persist across regenerated master projections', () => {
  assert.match(app, /state\.queue\?\.masterLedger\?\.id \|\| 'master'/);
  assert.match(app, /localStorage\.getItem\(legacyStorageKey\(\)\)/);
  assert.doesNotMatch(app, /function storageKey\(\) \{\s*return `content-swiper:\$\{REPOSITORY\}:\$\{state\.queue\?\.generatedAt/);
});

test('daily capacity display uses the full 15-placement ceiling', () => {
  assert.match(app, /count === 15/);
  assert.match(app, /count > 15/);
  assert.match(app, /Math\.min\(count, 15\) \/ 15/);
});

test('the public review projection uses only the canonical scheduledAt field', () => {
  assert.equal(queue.capacityPolicy.planningAnchorDate, '2026-08-09');
  assert.equal(queue.capacityPolicy.firstPublishDate, '2026-08-10');
  for (const post of publicPosts) {
    assert.equal('schedule' in post, false, `${post.id} has a shadow schedule field`);
    assert.ok(post.scheduledAt && typeof post.scheduledAt === 'object', `${post.id} is scheduled but has no scheduledAt object`);
    for (const value of Object.values(post.scheduledAt)) {
      assert.match(value, /^2026-08-(10|11)T/);
    }
  }
});

test('weekly hand-off has explicit send and read-only refresh controls', () => {
  assert.match(html, /Send approved week to Buffer/);
  assert.match(html, /Refresh status/);
  assert.match(app, /Open final scheduling confirmation/);
  assert.match(app, /complete week is then checked and released to Buffer/);
});

test('every live-ready public carousel has a packaged PDF and public thumbnail', () => {
  const carousels = publicPosts.filter((post) => post.format === 'carousel');
  assert.ok(carousels.length > 0);
  for (const post of carousels) {
    assert.equal(post.carousel.readiness, 'ready');
    assert.match(post.mediaUrl, /^https:\/\/222emails-review-desk\.netlify\.app\/.+\.pdf$/);
    assert.match(post.documentThumbnailUrl, /^https:\/\/222emails-review-desk\.netlify\.app\/.+\.jpg$/);
    assert.ok(post.carousel.pdfBytes > 0 && post.carousel.pdfBytes < 100 * 1024 * 1024);
    const pdfPath = path.join(root, 'apps/linkedin-review', new URL(post.mediaUrl).pathname.replace(/^\//, ''));
    const thumbnailPath = path.join(root, 'apps/linkedin-review', new URL(post.documentThumbnailUrl).pathname.replace(/^\//, ''));
    assert.equal(fs.statSync(pdfPath).size, post.carousel.pdfBytes);
    assert.equal(createHash('sha256').update(fs.readFileSync(pdfPath)).digest('hex'), post.carousel.pdfSha256);
    assert.ok(fs.statSync(thumbnailPath).size > 0);
  }
});