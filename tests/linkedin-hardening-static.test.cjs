'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const autopost = read('.github/workflows/linkedin-buffer-autopost.yml');
const verifier = read('.github/workflows/linkedin-publication-verifier.yml');
const intake = read('.github/workflows/linkedin-imap-pdf-intake.yml');
const reconcile = read('.github/workflows/linkedin-buffer-intent-reconcile.yml');
const retiredPdfIntake = read('.github/workflows/linkedin-pdf-intake.yml');
const retiredPdfShareNow = read('.github/workflows/linkedin-pdf-share-now.yml');
const backfill = read('.github/workflows/linkedin-publication-backfill.yml');
const queueOverlay = read('apps/linkedin-review/queue-overlay.js');
const strategy = read('docs/LINKEDIN_CONTENT_STRATEGY_2026.md');

test('all approved media is preflighted before the first Buffer createPost mutation', () => {
  const preflightIndex = autopost.indexOf('await preflightMedia(job.request, fetch)');
  const mutationIndex = autopost.indexOf('buildCreatePostMutation(channel, job.request.mode, media)');
  assert.ok(preflightIndex >= 0, 'media preflight call is missing');
  assert.ok(mutationIndex > preflightIndex, 'Buffer mutation can occur before media preflight');
  assert.match(autopost, /MEDIA_SHA256|mediaProof\.sha256/);
});

test('draft mode survives capacity planning into daily placement validation', () => {
  assert.match(autopost, /request: \{ mode: job\.request\.mode, channels: \[channel\] \}/);
  assert.match(autopost, /request: \{ mode: 'schedule', channels: \[\{ target: targetByChannelId\[entry\.channelId\], dueAt: entry\.dueAt \}\] \}/);
});

test('publication verifier is read-only towards Buffer and distinguishes sent, error and unknown', () => {
  assert.doesNotMatch(verifier, /mutation\s+CreatePost|createPost\s*\(/i);
  assert.doesNotMatch(verifier, /deletePost|updatePost|movePost/i);
  assert.match(verifier, /post\(input:\s*\{\s*id:/);
  assert.match(verifier, /post\.status === 'sent'/);
  assert.match(verifier, /post\.status === 'error'/);
  assert.match(verifier, /LINKEDIN_PUBLICATION_PENDING/);
  assert.match(verifier, /externalLink/);
  assert.match(verifier, /sentAt/);
  assert.match(verifier, /120 \* 24 \* 60 \* 60 \* 1000/);
});

test('publication verifier can recover accepted Buffer IDs from the trusted durable ledger', () => {
  assert.match(verifier, /Check out governed verification helpers/);
  assert.match(verifier, /ref: main/);
  assert.match(verifier, /selectTrustedLedgerIssue/);
  assert.match(verifier, /parseAcceptanceEntries/);
  assert.match(verifier, /parseIntentKeys/);
  assert.match(verifier, /issueByIntentKey/);
  assert.match(verifier, /durable_ledger_fallback/);
  assert.match(verifier, /rowsByBufferId/);
});

test('publication backfill is read-only and uses cursor pagination', () => {
  assert.doesNotMatch(backfill, /mutation\s+CreatePost|createPost\s*\(/i);
  assert.doesNotMatch(backfill, /deletePost|updatePost|movePost/i);
  assert.match(backfill, /hasNextPage/);
  assert.match(backfill, /endCursor/);
  assert.match(backfill, /after:/);
  assert.match(backfill, /LINKEDIN_PUBLICATION_VERIFIED/);
  assert.match(backfill, /LINKEDIN_PUBLICATION_FAILED/);
  assert.match(backfill, /LINKEDIN_DRAFT_CANARY_VERIFIED/);
  assert.match(backfill, /LINKEDIN_NATIVE_ANALYTICS_REQUIRED/);
  assert.match(backfill, /strictly read-only|read-only/i);
});

test('publication verification cannot label Buffer acceptance as publication', () => {
  assert.match(autopost, /Buffer acceptance, not proof of LinkedIn publication/);
  assert.match(verifier, /LINKEDIN_PUBLICATION_VERIFIED/);
});

test('non-public draft canaries terminate as verified drafts, fail closed on unexpected state, and stay out of analytics', () => {
  assert.match(verifier, /LINKEDIN_DRAFT_CANARY_VERIFIED/);
  assert.match(verifier, /post\.status === 'draft'/);
  assert.ok(verifier.includes("if (/^MODE:\\s*draft\\s*$/mi.test(String(issue.body || ''))) continue;"), 'analytics job must skip MODE: draft issues');
  assert.match(verifier, /Buffer draft canary entered an unexpected state/);
  assert.match(verifier, /Treat this canary as failed-safe and investigate before using the image path/);
  assert.match(verifier, /LINKEDIN_PUBLICATION_FAILED/);
});

test('public review UI filters non-public drafts before app.js consumes scheduledAt', () => {
  assert.match(queueOverlay, /post\.mode === 'schedule'/);
  assert.match(queueOverlay, /Object\.keys\(post\.scheduledAt\)\.length > 0/);
  assert.match(queueOverlay, /posts: publicPosts/);
  assert.match(queueOverlay, /excludedNonPublic/);
});

test('parallel repository PDF intake and immediate share-now lanes are retired', () => {
  assert.match(retiredPdfIntake, /RETIRED/);
  assert.match(retiredPdfIntake, /canonical governed route/i);
  assert.doesNotMatch(retiredPdfIntake, /linkedin-pdf-intake\.cjs/);
  assert.match(retiredPdfShareNow, /RETIRED/);
  assert.match(retiredPdfShareNow, /canonical governed route/i);
  assert.doesNotMatch(retiredPdfShareNow, /createPost\s*\(/);
  assert.doesNotMatch(retiredPdfShareNow, /mode:\s*shareNow/);
});

test('analytics loop retains a native LinkedIn route for document posts', () => {
  assert.match(verifier, /LINKEDIN_NATIVE_ANALYTICS_REQUIRED/);
  assert.match(verifier, /metricsUpdatedAt/);
  assert.match(verifier, /application\/pdf/);
});

test('new scheduling policy preserves old approvals and tests later-day windows', () => {
  assert.match(strategy, /Do \*\*not\*\* silently move an already owner-approved schedule/);
  assert.match(strategy, /15:00 and 20:00/);
  assert.match(strategy, /70% visual \/ 30% text-only/);
});

test('a surviving concurrency run drains every open approval rather than only its trigger issue', () => {
  assert.match(autopost, /state: 'open', creator: owner, per_page: 100/);
  assert.match(autopost, /sort\(\(a, b\) => a\.number - b\.number\)/);
  assert.doesNotMatch(autopost, /context\.eventName === 'issues'\s*\?\s*\[context\.payload\.issue\]/);
  assert.match(autopost, /full open approval queue|drain(?:s)? all/i);
});

test('one-shot approvals must exactly match a current locked queue revision', () => {
  assert.match(autopost, /requestFingerprint/);
  assert.match(autopost, /postBody\(queuePost\)/);
  assert.match(autopost, /approval body does not exactly match the locked queue copy, schedule, targets or media/);
  assert.match(autopost, /Legacy issue-only dispatch is disabled/);
  assert.doesNotMatch(autopost, /repository-owner-approved-legacy/);
});

test('production release fails closed without live Notion and uses one trusted durable ledger', () => {
  assert.match(autopost, /NOTION_API_KEY is missing\. Production LinkedIn release fails closed/);
  assert.match(autopost, /LEDGER_TITLE/);
  assert.match(autopost, /selectTrustedLedgerIssue/);
  assert.match(autopost, /state: 'all', per_page: 100/);
  assert.match(autopost, /commentWithRetry\(ledgerIssueNumber, acceptedBody\)/);
  assert.match(autopost, /commentWithRetry\(issue\.number, acceptedBody\)/);
  assert.match(autopost, /dispatchIntentComment/);
  assert.match(autopost, /unresolvedIntentKeys/);
});

test('dispatch-intent reconciliation is owner-gated, shares the release lock and never writes Buffer', () => {
  assert.match(reconcile, /github\.event\.issue\.user\.login == github\.repository_owner/);
  assert.match(reconcile, /group: linkedin-buffer-capacity-release/);
  assert.match(reconcile, /selectTrustedLedgerIssue/);
  assert.match(reconcile, /unresolvedIntentKeys/);
  assert.match(reconcile, /dispatchIntentMarker/);
  assert.match(reconcile, /canonicalMediaUrl/);
  assert.match(reconcile, /assets \{ source mimeType \}/);
  assert.match(reconcile, /mediaSourceMatches/);
  assert.match(reconcile, /status: \[scheduled, sent, error\]/);
  assert.match(reconcile, /recoverableStatuses/);
  assert.match(reconcile, /startDate/);
  assert.match(reconcile, /endDate/);
  assert.match(reconcile, /expected one exact Buffer match across channel, due time, caption and media source in scheduled\/sent\/error state/);
  assert.match(reconcile, /textDigest/);
  assert.doesNotMatch(reconcile, /createPost\s*\(|editPost\s*\(|deletePost\s*\(|mutation\s+/i);
  assert.match(reconcile, /Buffer write performed: \*\*NO\*\*/);
});

test('IMAP intake checks public hosting and verifies immutable PDF plus thumbnail bytes', () => {
  assert.match(intake, /visibility.*public/s);
  assert.match(intake, /revision-scoped media/);
  assert.match(intake, /id: pin/);
  assert.match(intake, /pinQueueMediaUrls/);
  assert.match(intake, /git rev-parse HEAD/);
  assert.match(intake, /Pinned media ref is not an immutable commit SHA/);
  assert.match(intake, /steps\.pin\.outputs\.pdf_url/);
  assert.match(intake, /steps\.pin\.outputs\.thumbnail_url/);
  assert.match(intake, /steps\.pin\.outputs\.media_ref/);
  assert.match(intake, /sha256sum \/tmp\/public\.jpg/);
  assert.match(intake, /sha256sum "\$local_thumb"/);
  assert.match(intake, /Immutable media commit/);
});
