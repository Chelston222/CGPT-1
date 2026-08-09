'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'apps/linkedin-review/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'apps/linkedin-review/app.js'), 'utf8');
const queue = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/queue.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/ledger-manifest.json'), 'utf8'));

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
  assert.equal(manifest.publicProjection.posts, queue.posts.length);
  assert.equal(manifest.rules.newContentEntersMasterFirst, true);
  assert.match(app, /queue\.masterLedger\.id !== ledger\.ledgerId/);
  assert.match(html, /id="master-total"/);
});

test('daily UI capacity uses ten total account placements', () => {
  assert.equal(queue.capacityPolicy.maximumAccountPlacementsPerDay, 10);
  assert.equal(queue.capacityPolicy.maximumAccountPlacementsPerWeek, 70);
  assert.match(html, /10 total account placements per day/);
  assert.match(app, /\$\{count\}\/10/);
});
