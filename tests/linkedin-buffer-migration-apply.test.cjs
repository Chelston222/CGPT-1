'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  EXPECTED_MANIFEST_BLOB_SHA,
  MIGRATION_ID,
  cadenceFailures,
  normalizeIso,
  parseBufferIdFromComments,
  parseHeaders,
  parseMigrationMarkers,
  validateManifest,
} = require('../scripts/linkedin-buffer-migration-apply.cjs');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/buffer-migration-2026-08-23.json'), 'utf8'));
const policy = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/distribution-policy.json'), 'utf8'));

assert.equal(MIGRATION_ID, 'buffer-migration-2026-08-23');
assert.equal(EXPECTED_MANIFEST_BLOB_SHA, '9bb89ddf0d8a392f03a4f8c97c5cead8d8faeb1c');
assert.equal(validateManifest(manifest).length, 4);

const approval = parseHeaders([
  'MIGRATION_ID: buffer-migration-2026-08-23',
  'MANIFEST_BLOB_SHA: 9bb89ddf0d8a392f03a4f8c97c5cead8d8faeb1c',
  'SOURCE_SNAPSHOT_ISSUE: 381',
  'PLAN_SELFTEST_ISSUE: 382',
  'APPLY: YES',
].join('\n'));
assert.equal(approval.MIGRATION_ID, MIGRATION_ID);
assert.equal(approval.APPLY, 'YES');

const row = manifest.placements.find((item) => item.id === 'tte-rr14-main-06');
const bufferId = parseBufferIdFromComments([
  { body: '✅ Buffer accepted every remaining requested destination.\n- tte-rr14-main-06@1 · Main 222 Emails page: Buffer post ID `6a89fc2ddeb4b57dfea8b628` — 2026-08-29T16:30:00.000Z' },
], row);
assert.equal(bufferId, '6a89fc2ddeb4b57dfea8b628');
assert.equal(parseBufferIdFromComments([{ body: 'unrelated' }], row), null);

const markers = parseMigrationMarkers([
  { body: '<!-- BUFFER_MIGRATION_INTENT key=tte-rr14-main-06@1:main action=REPURPOSE bufferId=x -->' },
  { body: '<!-- BUFFER_MIGRATION_APPLIED key=tte-rr14-main-06@1:main action=REPURPOSE bufferId=x -->' },
]);
assert(markers.intents.has('tte-rr14-main-06@1:main'));
assert(markers.applied.has('tte-rr14-main-06@1:main'));

assert.equal(normalizeIso('2026-09-02T17:00:00+01:00'), '2026-09-02T16:00:00.000Z');
assert.equal(normalizeIso('2026-09-02T15:45:00+01:00'), '2026-09-02T14:45:00.000Z');

const channelIds = { personal: 'p', main: 'm', secondary: 's' };
const targetByChannel = { p: 'personal', m: 'main', s: 'secondary' };
const planned = manifest.placements
  .filter((item) => item.decision === 'KEEP' || item.decision === 'MOVE')
  .map((item) => ({
    channelId: channelIds[item.target],
    dueAt: item.decision === 'MOVE' ? item.proposedDueAt : item.dueAt,
  }));
assert.deepEqual(cadenceFailures(planned, targetByChannel, policy, manifest.timezone), []);

const liveSource = manifest.placements.map((item) => ({
  channelId: channelIds[item.target],
  dueAt: item.bufferDueAt,
}));
const liveFailures = cadenceFailures(liveSource, targetByChannel, policy, manifest.timezone);
assert(liveFailures.includes('2026-W35:main 7>5/week'));
assert(liveFailures.includes('2026-W35:secondary 7>5/week'));

console.log('PASS linkedin-buffer-migration-apply');
