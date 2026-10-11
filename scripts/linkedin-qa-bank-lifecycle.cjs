'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const REVIEW_DIR = path.join(__dirname, '..', 'apps', 'linkedin-review');
const MANIFEST_NAME = 'qa-bank-lifecycle.json';
const BANK_NAME = /^qa-replenishment-.*\.json$/;

function qaBankPaths(reviewDir = REVIEW_DIR) {
  return fs.readdirSync(reviewDir).filter((name) => BANK_NAME.test(name)).sort()
    .map((name) => path.join(reviewDir, name));
}

// Only explicit lifecycle states exclude a record. Missing/invalid QA flags on an
// otherwise active record must still fail the active-bank audit, never hide it.
function classifyQaPost(post, bankLifecycle) {
  if (bankLifecycle) return bankLifecycle.state;
  const states = [post.status, post.qa?.status];
  if (states.includes('retired')) return 'retired';
  if (states.some((state) => ['hold', 'on_hold', 'held'].includes(state))) return 'held';
  if (states.some((state) => ['draft', 'owner_copy_approved_pre_media'].includes(state))) return 'draft';
  return 'active';
}

function readQaBanks(reviewDir = REVIEW_DIR) {
  // A missing or invalid manifest is a hard failure for both audit and release.
  // Historical source bytes are pinned rather than repaired into live eligibility.
  const manifest = JSON.parse(fs.readFileSync(path.join(reviewDir, MANIFEST_NAME), 'utf8'));
  if (manifest.schemaVersion !== 1 || !manifest.banks || typeof manifest.banks !== 'object' || Array.isArray(manifest.banks)) {
    throw new Error(`${MANIFEST_NAME}: expected schemaVersion 1 and a banks object.`);
  }
  const files = qaBankPaths(reviewDir);
  const names = new Set(files.map((file) => path.basename(file)));
  for (const [name, entry] of Object.entries(manifest.banks)) {
    if (!BANK_NAME.test(name) || path.basename(name) !== name || !names.has(name)) throw new Error(`${MANIFEST_NAME}: unknown bank ${name}.`);
    if (!entry || !['draft', 'superseded'].includes(entry.state) || !/^[a-f0-9]{64}$/.test(entry.sha256 || '') || !String(entry.reason || '').trim()) {
      throw new Error(`${MANIFEST_NAME}/${name}: state, SHA-256 and reason are required.`);
    }
    if (!names.has(entry.replacedBy) || entry.replacedBy === name || Object.hasOwn(manifest.banks, entry.replacedBy)) {
      throw new Error(`${MANIFEST_NAME}/${name}: replacedBy must identify an active bank.`);
    }
  }
  return files.map((file) => {
    const name = path.basename(file);
    const bytes = fs.readFileSync(file);
    const bankLifecycle = manifest.banks[name];
    if (bankLifecycle && createHash('sha256').update(bytes).digest('hex') !== bankLifecycle.sha256) {
      throw new Error(`${name}: historical bank SHA-256 differs from ${MANIFEST_NAME}; review the lifecycle manifest before release.`);
    }
    const payload = JSON.parse(bytes.toString('utf8'));
    if (!Number.isInteger(payload?.schemaVersion)) throw new Error(`${name}: schemaVersion must be an integer.`);
    if (!Array.isArray(payload.posts)) throw new Error(`${name}: posts must be an array.`);
    if (payload.posts.some((post) => !post || typeof post !== 'object' || Array.isArray(post))) throw new Error(`${name}: every post must be an object.`);
    return { name, payload, bankLifecycle, records: payload.posts.map((post) => ({ post, lifecycle: classifyQaPost(post, bankLifecycle) })) };
  });
}

module.exports = { classifyQaPost, qaBankPaths, readQaBanks };
