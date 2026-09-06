'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const {
  MAX_DOCUMENT_BYTES,
  canonicalMediaUrl,
} = require('../scripts/linkedin-media-preflight.cjs');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'apps/linkedin-review/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'apps/linkedin-review/app.js'), 'utf8');
const queue = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/queue.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/ledger-manifest.json'), 'utf8'));
const distributionPolicy = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/distribution-policy.json'), 'utf8'));
const publicPosts = queue.posts.filter((post) => post.mode === 'schedule');
const draftPosts = queue.posts.filter((post) => post.mode === 'draft');
const TARGETS = ['personal', 'main', 'secondary'];

function localDate(value) {
  assert.ok(!Number.isNaN(Date.parse(value)), `Invalid scheduledAt value ${value}`);
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})T/);
  assert.ok(match, `scheduledAt must begin with an ISO local date: ${value}`);
  return match[1];
}

function mondayOf(dateString) {
  const date = new Date(`${dateString}T12:00:00Z`);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
}

function addCount(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function repoAssetPath(url) {
  let canonical;
  try {
    canonical = canonicalMediaUrl(url);
  } catch {
    return null;
  }
  const parsed = new URL(canonical);
  if (parsed.hostname.toLowerCase() !== 'raw.githubusercontent.com') return null;
  const prefix = '/Chelston222/CGPT-1/main/apps/linkedin-review/';
  if (!parsed.pathname.startsWith(prefix)) return null;
  return path.join(root, 'apps/linkedin-review', decodeURIComponent(parsed.pathname.slice(prefix.length)));
}

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

test('Swiper keeps Master Ledger lineage while queue revisions remain the live release lock', () => {
  assert.equal(queue.masterLedger.id, manifest.ledgerId);
  assert.equal(queue.masterLedger.projection, 'live_ready_human_review');
  assert.equal(manifest.publicProjection.file, 'queue.json');
  assert.equal(manifest.rules.historicalApprovalIsNotPublishPermission, true);
  assert.match(queue.approvalRule, /\[APPROVED LINKEDIN/);
  assert.match(app, /queue\.masterLedger\.id !== ledger\.ledgerId/);
  assert.match(html, /id="master-total"/);

  // The private Master Ledger is rebuilt outside the deployed repository. A
  // newer governed queue may therefore legitimately outgrow an older manifest
  // snapshot (for example after repo-native PDF intake). Never pretend an old
  // snapshot is current: if counts differ, its timestamp must be older.
  if (manifest.publicProjection.posts !== queue.posts.length) {
    assert.ok(
      Date.parse(manifest.generatedAt) < Date.parse(queue.generatedAt),
      'ledger-manifest count drift is only valid when the manifest is an older private-ledger snapshot',
    );
  }
});

test('queue IDs and immutable revisions are unambiguous', () => {
  const ids = new Set();
  for (const post of queue.posts) {
    assert.match(post.id, /^[a-z0-9][a-z0-9-]{2,79}$/i);
    assert.ok(!ids.has(post.id), `duplicate queue ID ${post.id}`);
    ids.add(post.id);
    assert.ok(Number.isInteger(Number(post.revision)) && Number(post.revision) >= 1, `${post.id} has an invalid revision`);
    assert.ok(Array.isArray(post.targets) && post.targets.length > 0, `${post.id} has no target`);
    assert.ok(post.targets.every((target) => TARGETS.includes(target)), `${post.id} has an unsupported target`);
    assert.ok(String(post.copy?.default || post.copy?.[post.targets[0]] || '').trim(), `${post.id} has no publishable copy`);
  }
});

test('non-public drafts remain outside the public scheduling projection', () => {
  for (const post of draftPosts) {
    assert.equal(post.mode, 'draft');
    assert.ok(!post.scheduledAt || Object.keys(post.scheduledAt).length === 0, `${post.id} unexpectedly has a public schedule`);
  }
  assert.equal(publicPosts.length + draftPosts.length, queue.posts.length);
});

test('current distribution policy governs new schedules while Buffer capacity stays separate', () => {
  assert.equal(queue.capacityPolicy.bufferFreeScheduledPerChannel, 10);
  assert.equal(queue.capacityPolicy.maximumPlacementsPerChannelPerDay, 5);
  assert.equal(queue.capacityPolicy.maximumAccountPlacementsPerDay, 15);
  assert.equal(queue.capacityPolicy.maximumAccountPlacementsPerWeek, 105);
  assert.equal(distributionPolicy.timezone, 'Europe/London');
  assert.match(html, /Buffer Free holds 10 scheduled posts per account/);
  assert.match(app, /placements\.length} prepared/);

  const effectiveDate = distributionPolicy.effectiveDate;
  const daily = new Map();
  const weekly = new Map();
  for (const post of publicPosts) {
    for (const target of post.targets) {
      const value = post.scheduledAt?.[target];
      assert.ok(value, `${post.id} is missing scheduledAt.${target}`);
      const date = localDate(value);
      if (date < effectiveDate) continue;
      addCount(daily, `${target}:${date}`);
      addCount(weekly, `${target}:${mondayOf(date)}`);
    }
  }

  for (const [key, count] of daily) {
    const target = key.split(':')[0];
    const maximum = distributionPolicy.accounts[target].maximumPerDay;
    assert.ok(count <= maximum, `${key} has ${count} placements, above the governed ${maximum}/day`);
  }
  for (const [key, count] of weekly) {
    const target = key.split(':')[0];
    const maximum = distributionPolicy.accounts[target].maximumPerWeek;
    assert.ok(count <= maximum, `${key} has ${count} placements, above the governed ${maximum}/week`);
  }
});

test('review decisions persist across regenerated master projections', () => {
  assert.match(app, /state\.queue\?\.masterLedger\?\.id \|\| 'master'/);
  assert.match(app, /localStorage\.getItem\(legacyStorageKey\(\)\)/);
  assert.doesNotMatch(app, /function storageKey\(\) \{\s*return `content-swiper:\$\{REPOSITORY\}:\$\{state\.queue\?\.generatedAt/);
});

test('daily capacity display keeps the broad 15-placement safety ceiling explicit', () => {
  assert.match(app, /count === 15/);
  assert.match(app, /count > 15/);
  assert.match(app, /Math\.min\(count, 15\) \/ 15/);
});

test('the public review projection uses one canonical, valid scheduledAt field', () => {
  assert.ok(!Number.isNaN(Date.parse(`${queue.capacityPolicy.firstPublishDate}T00:00:00Z`)));
  for (const post of publicPosts) {
    assert.equal('schedule' in post, false, `${post.id} has a shadow schedule field`);
    assert.ok(post.scheduledAt && typeof post.scheduledAt === 'object', `${post.id} is scheduled but has no scheduledAt object`);
    assert.deepEqual(Object.keys(post.scheduledAt).sort(), [...post.targets].sort(), `${post.id} scheduledAt targets drift from targets[]`);
    for (const value of Object.values(post.scheduledAt)) {
      const date = localDate(value);
      assert.ok(date >= queue.capacityPolicy.firstPublishDate, `${post.id} is scheduled before the queue's first publish date`);
    }
  }
});

test('weekly hand-off has explicit send and read-only refresh controls', () => {
  assert.match(html, /Send approved week to Buffer/);
  assert.match(html, /Refresh status/);
  assert.match(app, /Open final scheduling confirmation/);
  assert.match(app, /complete week is then checked and released to Buffer/);
});

test('every live-ready public carousel has locked media metadata and an allowed transport', () => {
  const carousels = publicPosts.filter((post) => post.format === 'carousel');
  assert.ok(carousels.length > 0);
  for (const post of carousels) {
    assert.equal(post.carousel.readiness, 'ready');
    assert.doesNotThrow(() => new URL(canonicalMediaUrl(post.mediaUrl, 'MEDIA_URL')));
    assert.doesNotThrow(() => new URL(canonicalMediaUrl(post.documentThumbnailUrl, 'DOCUMENT_THUMBNAIL_URL')));
    assert.ok(post.carousel.pdfBytes > 0 && post.carousel.pdfBytes <= MAX_DOCUMENT_BYTES);
    assert.match(post.carousel.pdfSha256, /^[a-f0-9]{64}$/i);

    // Repository-backed assets can be proven byte-for-byte at CI time. External
    // HTTPS assets are still checked by the runtime media preflight before any
    // Buffer dispatch, so this test does not invent a second URL allow-list.
    const pdfPath = repoAssetPath(post.mediaUrl);
    if (pdfPath) {
      assert.ok(fs.existsSync(pdfPath), `${post.id} repository PDF is missing`);
      assert.equal(fs.statSync(pdfPath).size, post.carousel.pdfBytes);
      assert.equal(createHash('sha256').update(fs.readFileSync(pdfPath)).digest('hex'), post.carousel.pdfSha256);
    }
    const thumbnailPath = repoAssetPath(post.documentThumbnailUrl);
    if (thumbnailPath) {
      assert.ok(fs.existsSync(thumbnailPath), `${post.id} repository thumbnail is missing`);
      assert.ok(fs.statSync(thumbnailPath).size > 0);
    }
  }
});

test('repo-native PDF intake remains review-gated and integrity-locked', () => {
  for (const post of queue.posts.filter((item) => item.sourceType === 'chatgpt_pdf_intake')) {
    assert.equal(post.status, 'review');
    assert.equal(post.format, 'carousel');
    assert.equal(post.carousel?.readiness, 'ready');
    assert.match(post.carousel?.pdfSha256 || '', /^[a-f0-9]{64}$/i);
    assert.ok(Number(post.carousel?.pdfBytes) > 0);
    assert.match(post.history?.[0]?.note || '', /No publish authority implied/);
  }
});
