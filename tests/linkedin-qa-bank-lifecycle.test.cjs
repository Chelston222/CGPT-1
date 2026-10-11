'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { auditQaBanks } = require('../scripts/linkedin-qa-bank-audit.cjs');
const { classifyQaPost, readQaBanks } = require('../scripts/linkedin-qa-bank-lifecycle.cjs');
const { postBody, withQaReplenishment } = require('../scripts/linkedin-week-batch.cjs');

function record(id = 'active-post') {
  return {
    id, revision: 1, title: 'Governed record', category: 'diagnosis',
    format: 'text', targets: ['personal'], mode: 'schedule',
    scheduledAt: { personal: '2026-10-12T12:00:00+01:00' },
    copy: { default: 'Local test copy that never enters a live service.' },
    status: 'review', qa: { status: 'ready_for_human_review', approvalEligible: true, publishPermission: false },
  };
}

function fixture(t, posts = [record()]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkedin-qa-lifecycle-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (name, payload) => fs.writeFileSync(path.join(dir, name), `${JSON.stringify(payload, null, 2)}\n`);
  write('qa-bank-lifecycle.json', { schemaVersion: 1, banks: {} });
  write('queue.json', { schemaVersion: 2, posts: [] });
  write('distribution-policy.json', { timezone: 'Europe/London', accounts: { personal: { allowedContentRoles: ['diagnosis'] } } });
  write('qa-replenishment-current.json', { schemaVersion: 1, posts });
  return { dir, write };
}

function snapshot(dir) {
  return fs.readdirSync(dir).sort().map((name) => [name, fs.readFileSync(path.join(dir, name), 'utf8')]);
}

function releasePool(dir) {
  return withQaReplenishment({ schemaVersion: 2, posts: [] }, { reviewDir: dir, applyScheduleOverrides: false });
}

function archive(f, posts = [record('superseded-post')]) {
  const name = 'qa-replenishment-old.json';
  f.write(name, { schemaVersion: 1, posts });
  const sha256 = createHash('sha256').update(fs.readFileSync(path.join(f.dir, name))).digest('hex');
  f.write('qa-bank-lifecycle.json', {
    schemaVersion: 1,
    banks: { [name]: { state: 'superseded', sha256, reason: 'Replaced by the current immutable release revision.', replacedBy: 'qa-replenishment-current.json' } },
  });
  return name;
}

test('explicit retired, held and pre-media states remain blocked and byte-identical', (t) => {
  const retired = { ...record('retired-post'), status: 'retired', qa: { status: 'retired', approvalEligible: false, publishPermission: false } };
  const held = { ...record('held-post'), status: 'on_hold', qa: { status: 'hold', approvalEligible: false, publishPermission: false } };
  const draft = { ...record('draft-post'), status: 'owner_copy_approved_pre_media', mode: 'draft', format: 'text_or_photo', scheduledAt: undefined, qa: { publishPermission: false } };
  const f = fixture(t, [record(), retired, held, draft]);
  const before = snapshot(f.dir);
  const audit = auditQaBanks({ reviewDir: f.dir });
  assert.equal(audit.ok, true, audit.errors.join('\n'));
  assert.equal(audit.activeQaPosts, 1);
  assert.equal(audit.inactiveQaPosts, 3);
  assert.deepEqual(releasePool(f.dir).posts.map((post) => post.id), ['active-post']);
  assert.deepEqual(snapshot(f.dir), before);
});

test('pinned superseded snapshots may retain malformed copy and old flags, never release', (t) => {
  const f = fixture(t);
  archive(f, [{ ...record('active-post'), copy: 'Historical serialization error retained.' }]);
  const before = snapshot(f.dir);
  const audit = auditQaBanks({ reviewDir: f.dir });
  assert.equal(audit.ok, true, audit.errors.join('\n'));
  assert.equal(audit.inactiveQaPosts, 1);
  assert.deepEqual(releasePool(f.dir).posts, [record()]);
  assert.deepEqual(snapshot(f.dir), before);
});

test('manifest tampering fails audit and release closed', (t) => {
  const f = fixture(t);
  const name = archive(f);
  fs.appendFileSync(path.join(f.dir, name), '\n');
  const audit = auditQaBanks({ reviewDir: f.dir });
  assert.equal(audit.ok, false);
  assert.match(audit.errors.join('\n'), /SHA-256/);
  assert.throws(() => releasePool(f.dir), /SHA-256/);
});

test('missing manifest fails audit and release closed', (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.dir, 'qa-bank-lifecycle.json'));
  assert.equal(auditQaBanks({ reviewDir: f.dir }).ok, false);
  assert.throws(() => releasePool(f.dir), /qa-bank-lifecycle/);
});

test('manifest cannot name nonexistent files or silently archive without a replacement', (t) => {
  const f = fixture(t);
  f.write('qa-bank-lifecycle.json', { schemaVersion: 1, banks: { 'qa-replenishment-missing.json': {} } });
  assert.throws(() => readQaBanks(f.dir), /unknown bank/);
  archive(f);
  const manifestPath = path.join(f.dir, 'qa-bank-lifecycle.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.banks['qa-replenishment-old.json'].replacedBy = 'qa-replenishment-missing.json';
  f.write('qa-bank-lifecycle.json', manifest);
  assert.throws(() => readQaBanks(f.dir), /replacedBy/);
});

test('bad active QA flags are audit failures, not automatic lifecycle exemptions', (t) => {
  const post = record();
  post.qa.approvalEligible = false;
  const f = fixture(t, [post]);
  assert.equal(classifyQaPost(post), 'active');
  const audit = auditQaBanks({ reviewDir: f.dir });
  assert.equal(audit.ok, false);
  assert.match(audit.errors.join('\n'), /QA flags/);
  assert.equal(audit.inactiveQaPosts, 0);
  assert.equal(releasePool(f.dir).posts.length, 0);
});

test('retired and held records with contradictory approval flags remain blocked and fail audit', (t) => {
  const f = fixture(t, [{ ...record(), status: 'retired' }]);
  assert.equal(auditQaBanks({ reviewDir: f.dir }).ok, false);
  assert.equal(releasePool(f.dir).posts.length, 0);
});

test('active malformed copy and schedule still fail strict validation', (t) => {
  const f = fixture(t, [{ ...record(), copy: 'Not copy.default', scheduledAt: {} }]);
  const audit = auditQaBanks({ reviewDir: f.dir });
  assert.equal(audit.ok, false);
  assert.match(audit.errors.join('\n'), /copy.default is required/);
  assert.match(audit.errors.join('\n'), /valid scheduledAt.personal is required/);
});

test('active duplicate IDs fail audit and loader rather than choosing by filename', (t) => {
  const f = fixture(t);
  f.write('qa-replenishment-duplicate.json', { schemaVersion: 1, posts: [record()] });
  const audit = auditQaBanks({ reviewDir: f.dir });
  assert.equal(audit.ok, false);
  assert.match(audit.errors.join('\n'), /duplicate QA post id/);
  assert.throws(() => releasePool(f.dir), /duplicate active QA post id/);
});

test('active exact promotions pass, while copy/revision drift stays a hard failure', (t) => {
  const f = fixture(t);
  f.write('queue.json', { schemaVersion: 2, posts: [record()] });
  const exact = auditQaBanks({ reviewDir: f.dir });
  assert.equal(exact.ok, true);
  assert.equal(exact.exactPromotions.length, 1);
  f.write('queue.json', { schemaVersion: 2, posts: [{ ...record(), revision: 2 }] });
  const drifted = auditQaBanks({ reviewDir: f.dir });
  assert.equal(drifted.ok, false);
  assert.match(drifted.errors.join('\n'), /release contract has drifted/);
});

test('active current-policy copy, similarity and cadence rules still block release readiness', (t) => {
  const copy = 'Aesthetic clinic owners can inspect the existing customer journey before paying for additional demand. An unanswered enquiry, a cancelled appointment and a returning customer need different next steps. The team should record which gap they observe and use reliable evidence to decide where their next effort can make a difference.';
  const post = { ...record(), sourceType: 'performance_learning_v2', contentRole: 'diagnosis', copy: { default: copy } };
  const f = fixture(t, [post, ...[1, 2, 3].map((i) => ({ ...post, id: `active-${i}`, scheduledAt: { personal: `2026-10-12T${13 + i}:00:00+01:00` } }))]);
  const audit = auditQaBanks({ reviewDir: f.dir });
  assert.equal(audit.ok, false);
  assert.match(audit.errors.join('\n'), /too textually similar/);
  assert.match(audit.errors.join('\n'), /current cadence maximum is 3/);
  f.write('qa-replenishment-current.json', { schemaVersion: 1, posts: [{ ...post, copy: { default: 'Too thin — 222 Emails' } }] });
  const thin = auditQaBanks({ reviewDir: f.dir });
  assert.match(thin.errors.join('\n'), /too thin/);
  assert.match(thin.errors.join('\n'), /em dash is prohibited/);
  assert.match(thin.errors.join('\n'), /use 222Emails/);
});

test('real repository inventory is lifecycle-aware and every historical byte hash verifies', () => {
  const result = auditQaBanks();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.inactiveRecords.filter((record) => record.lifecycle === 'superseded').length, 51);
  assert.equal(result.inactiveRecords.filter((record) => record.lifecycle === 'draft').length, 17);
  for (const id of ['tte-learning-v2-personal-01', 'tte-learning-v2-personal-02', 'tte-context-pass-personal-001', 'tte-context-pass-personal-002', 'tte-context-pass-personal-003']) {
    assert.ok(result.inactiveRecords.some((record) => record.id === id && record.lifecycle === 'retired'), `${id} remains retired`);
  }
});


test('canonical queue cannot reactivate the same explicitly non-active QA revision', (t) => {
  const retired = { ...record(), status: 'retired', qa: { status: 'retired', approvalEligible: false, publishPermission: false } };
  const f = fixture(t, [retired]);
  f.write('queue.json', { schemaVersion: 2, posts: [record()] });
  const audit = auditQaBanks({ reviewDir: f.dir });
  assert.equal(audit.ok, false);
  assert.match(audit.errors.join('\n'), /non-active QA revision is active in queue.json/);
  assert.throws(() => withQaReplenishment({ posts: [record()] }, { reviewDir: f.dir, applyScheduleOverrides: false }), /non-active in QA history/);
  // An already retired canonical row is preserved; it cannot become a release request.
  const queue = { posts: [retired] };
  assert.deepEqual(withQaReplenishment(queue, { reviewDir: f.dir, applyScheduleOverrides: false }), queue);
  assert.throws(() => postBody(retired), /non-active/);
});

test('superseded canonical revision is blocked but distinct later revisions are not silently retired', (t) => {
  const f = fixture(t);
  archive(f, [record('old-post')]);
  assert.throws(() => withQaReplenishment({ posts: [record('old-post')] }, { reviewDir: f.dir, applyScheduleOverrides: false }), /non-active in QA history/);
  const newer = { ...record('old-post'), revision: 2 };
  const result = withQaReplenishment({ posts: [newer] }, { reviewDir: f.dir, applyScheduleOverrides: false });
  assert.deepEqual(result.posts[0], newer);
});

test('canonical-only held and draft records cannot generate release bodies', () => {
  for (const status of ['retired', 'hold', 'on_hold', 'held', 'draft', 'owner_copy_approved_pre_media']) {
    assert.throws(() => postBody({ ...record(), status }), /non-active/);
  }
});
