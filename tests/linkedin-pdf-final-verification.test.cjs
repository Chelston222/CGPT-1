'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const playbook = read('docs/222EMAILS_LINKEDIN_PDF_CAROUSEL_ULTRA_PLAYBOOK.md');
const config = read('scripts/linkedin-imap-intake-config.cjs');
const intake = read('.github/workflows/linkedin-imap-pdf-intake.yml');
const autopost = read('.github/workflows/linkedin-buffer-autopost.yml');
const reconcile = read('.github/workflows/linkedin-buffer-intent-reconcile.yml');
const verifier = read('.github/workflows/linkedin-publication-verifier.yml');
const retiredIntake = read('.github/workflows/linkedin-pdf-intake.yml');
const retiredShareNow = read('.github/workflows/linkedin-pdf-share-now.yml');

// This file is intentionally narrow. It certifies the non-negotiable architecture
// after the sequential RED TEAM and VERIFY gauntlet without duplicating every unit test.

test('canonical playbook remains the single default PDF publishing route', () => {
  assert.match(playbook, /CANONICAL VERIFIED v1\.0\.1/);
  assert.match(playbook, /Do not invent a parallel production route/);
  assert.match(playbook, /Gmail transport[\s\S]*PrivateEmail IMAP[\s\S]*governed GitHub LinkedIn queue/);
  assert.match(playbook, /repository-owner \[APPROVED LINKEDIN\] gate/);
  assert.match(playbook, /durable Buffer dispatch intent/);
  assert.match(playbook, /separate due-time publication verifier/);
});

test('canonical intake fails closed on public exposure, copy, target and schedule ambiguity', () => {
  assert.match(config, /publicMediaApproved must be true/);
  assert.match(config, /publicReleaseMaterialApproved must be true/);
  assert.match(config, /copy\.default as the only copy variant/);
  assert.match(config, /exactly one target/);
  assert.match(config, /exactly one schedule key matching the single target/);
  assert.match(config, /within 90 days/);
  assert.match(config, /RESERVED_COPY_MARKER/);
  assert.match(config, /manifest\.copy\.default must be 1-3000 characters/);
});

test('media promotion remains revision-scoped, replay-safe and immutable before release', () => {
  assert.match(intake, /revision-scoped media/i);
  assert.match(intake, /pinQueueMediaUrls/);
  assert.match(intake, /git rev-parse HEAD/);
  assert.match(intake, /Pinned media ref is not an immutable commit SHA/);
  assert.match(intake, /sha256sum \/tmp\/public\.pdf/);
  assert.match(intake, /sha256sum \/tmp\/public\.jpg/);
});

test('Buffer release preserves exact queue authority and durable idempotency', () => {
  assert.match(autopost, /requestFingerprint/);
  assert.match(autopost, /approval body does not exactly match the locked queue copy, schedule, targets or media/);
  assert.match(autopost, /dispatchIntentComment/);
  assert.match(autopost, /commentWithRetry\(ledgerIssueNumber, acceptedBody\)/);
  assert.match(autopost, /Unresolved prior Buffer dispatch intent/);
  assert.match(autopost, /owner-approved-current-queue-no-notion-secret/);
  assert.match(autopost, /await assertLiveNotionQualityGate\(liveQueuePost/);
});

test('uncertain Buffer writes are reconciled read-only and publication remains separately proven', () => {
  assert.match(reconcile, /assets \{ source mimeType \}/);
  assert.match(reconcile, /status: \[scheduled, sent, error\]/);
  assert.doesNotMatch(reconcile, /createPost\s*\(|editPost\s*\(|deletePost\s*\(|mutation\s+/i);
  assert.match(verifier, /post\.status === 'sent'/);
  assert.match(verifier, /sentAt/);
  assert.match(verifier, /LINKEDIN_PUBLICATION_VERIFIED/);
  assert.doesNotMatch(verifier, /mutation\s+CreatePost|createPost\s*\(/i);
});

test('legacy parallel PDF production lanes remain retired', () => {
  assert.match(retiredIntake, /RETIRED/);
  assert.match(retiredShareNow, /RETIRED/);
  assert.doesNotMatch(retiredIntake, /linkedin-pdf-intake\.cjs/);
  assert.doesNotMatch(retiredShareNow, /createPost\s*\(/);
});
