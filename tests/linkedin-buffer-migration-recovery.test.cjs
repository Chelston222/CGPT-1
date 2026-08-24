'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  SOURCE_APPROVAL_ISSUE,
  SOURCE_PROGRESS_SNAPSHOT_ISSUE,
  lockedMoveCopy,
  run,
} = require('../scripts/linkedin-buffer-migration-recovery.cjs');
const {
  EXPECTED_MANIFEST_BLOB_SHA,
  MIGRATION_ID,
  normalizeIso,
  validateManifest,
} = require('../scripts/linkedin-buffer-migration-apply.cjs');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/buffer-migration-2026-08-23.json'), 'utf8'));

assert.equal(SOURCE_APPROVAL_ISSUE, 386);
assert.equal(SOURCE_PROGRESS_SNAPSHOT_ISSUE, 387);
assert.equal(MIGRATION_ID, 'buffer-migration-2026-08-23');
assert.equal(EXPECTED_MANIFEST_BLOB_SHA, '9bb89ddf0d8a392f03a4f8c97c5cead8d8faeb1c');
assert.equal(validateManifest(manifest).length, 4);
assert.equal(typeof run, 'function');
assert.equal(typeof lockedMoveCopy, 'function');
assert.equal(manifest.placements.filter((row) => row.decision === 'MOVE').length, 2);
assert.equal(manifest.placements.filter((row) => row.decision === 'REPURPOSE').length, 2);
assert.equal(manifest.placements.filter((row) => row.decision === 'RETIRE').length, 0);

const moveCopy = lockedMoveCopy(root, manifest);
assert.equal(moveCopy.size, 2);
for (const row of manifest.placements.filter((item) => item.decision === 'MOVE')) {
  const key = `${row.id}@${row.revision}`;
  const locked = moveCopy.get(key);
  assert(locked, `${key} must exist in effective queue`);
  assert.equal(Boolean(locked.post.mediaUrl), false, `${key} must remain text-only for this migration`);
  assert(String(locked.text || '').trim().length > 0, `${key} must have exact locked text`);
  assert.equal(normalizeIso(locked.post.scheduledAt[row.target]), normalizeIso(row.bufferDueAt), `${key} original schedule must match manifest`);
  assert((locked.post.targets || []).includes(row.target), `${key} target must match manifest`);
}

const main07 = moveCopy.get('tte-rr14-main-07@1');
const secondary07 = moveCopy.get('tte-rr14-secondary-07@1');
assert(main07.text.includes('Dormant customers'));
assert(secondary07.text.includes('Revenue Recovery'));

console.log('PASS linkedin-buffer-migration-recovery');
