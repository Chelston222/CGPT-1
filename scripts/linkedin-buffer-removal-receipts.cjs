'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { EXPECTED_MANIFEST_BLOB_SHA, MANIFEST_PATH, MIGRATION_ID, validateManifest } = require('./linkedin-buffer-migration-apply.cjs');

// Historical removals are evidence of NON-publication, never release authority.
function trustedOwner(issue, ownerLogin) {
  return ownerLogin === 'Chelston222' && !issue?.pull_request
    && issue?.user?.login === ownerLogin && issue.user.id === 246655273
    && issue.author_association === 'OWNER';
}

function trustedReceipt(comment, issueNumber) {
  return comment?.user?.login === 'github-actions[bot]' && comment.user.id === 41898282
    && comment.user.type === 'Bot' && comment.performed_via_github_app?.id === 15368
    && comment.performed_via_github_app?.slug === 'github-actions'
    && Number.isSafeInteger(comment.id)
    && comment.html_url === 'https://github.com/Chelston222/CGPT-1/issues/' + issueNumber + '#issuecomment-' + comment.id;
}

function headers(body = '') {
  const out = {};
  for (const line of String(body).split(/\r?\n/)) {
    if (line.trim() === '---') break;
    const match = /^([A-Z][A-Z0-9_]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    if (Object.hasOwn(out, match[1])) return null;
    out[match[1]] = match[2].trim();
  }
  return out;
}

function exactIds(ids, expected) {
  return ids.length > 0 && ids.length === expected.length && new Set(ids).size === ids.length
    && ids.every(id => expected.includes(id));
}

function isRemovalRequest(issue) {
  return /^\[(?:RUN BUFFER CLEANUP|BUFFER CLEANUP|APPROVED BUFFER MIGRATION)\]/.test(issue?.title || '');
}

function parseCompletedCleanup(issue, comments = [], ownerLogin) {
  const found = new Map();
  if (!trustedOwner(issue, ownerLogin) || !/^\[(?:RUN BUFFER CLEANUP|BUFFER CLEANUP)\]/.test(issue.title || '')) return found;
  const approval = headers(issue.body);
  const expected = String(approval?.DELETE_POST_IDS || '').split(',').map(id => id.trim());
  if (!expected.length || expected.some(id => !/^[a-zA-Z0-9_-]+$/.test(id)) || new Set(expected).size !== expected.length) return found;
  const legacy = issue.title.startsWith('[BUFFER CLEANUP]');
  for (const comment of comments) {
    if (!trustedReceipt(comment, issue.number)) continue;
    const body = String(comment.body || '');
    const lines = body.split(/\r?\n/).filter(line => line.startsWith('- '));
    let ids;
    if (legacy) {
      if (!body.startsWith('✅ Buffer priority cleanup complete.')) continue;
      const counts = [...body.matchAll(/^Deleted \*\*(\d+)\*\* explicitly listed scheduled posts\.$/gm)];
      if (counts.length !== 1 || Number(counts[0][1]) !== expected.length) continue;
      ids = lines.map(line => /^- `([a-zA-Z0-9_-]+)`$/.exec(line)?.[1]);
    } else {
      ids = lines.map(line => /^- Deleted Buffer post `([a-zA-Z0-9_-]+)` \(DeletePostSuccess\)$/.exec(line)?.[1]);
    }
    // An extra, duplicate or failed deletion invalidates the whole receipt.
    if (!exactIds(ids, expected)) continue;
    for (const id of ids) found.set(id, { issueNumber: issue.number, evidenceUrl: comment.html_url, kind: 'cleanup' });
  }
  return found;
}

function pinnedManifest(bytes) {
  const blob = Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes]);
  if (createHash('sha1').update(blob).digest('hex') !== EXPECTED_MANIFEST_BLOB_SHA) throw new Error('Historical removal manifest differs from the owner-approved blob.');
  const manifest = JSON.parse(bytes.toString('utf8'));
  validateManifest(manifest);
  return manifest;
}

function migrationMarkers(comments, issueNumber) {
  const intents = new Map(), applied = new Map(), invalid = new Set();
  for (const comment of comments) {
    if (!trustedReceipt(comment, issueNumber)) continue;
    for (const match of String(comment.body || '').matchAll(/<!-- BUFFER_MIGRATION_(INTENT|APPLIED) ([^\n]*?) -->/g)) {
      const fields = {};
      let malformed = false;
      for (const token of match[2].split(/\s+/)) {
        const pair = /^([a-zA-Z]+)=([^\s]+)$/.exec(token);
        if (!pair || Object.hasOwn(fields, pair[1])) { malformed = true; break; }
        fields[pair[1]] = pair[2];
      }
      const key = fields.key;
      if (!key) continue;
      const map = match[1] === 'INTENT' ? intents : applied;
      if (malformed || map.has(key)) { invalid.add(key); continue; }
      map.set(key, { ...fields, evidenceUrl: comment.html_url });
    }
  }
  return { intents, applied, invalid };
}

function parseCompletedRepurpose(issue, comments = [], ownerLogin, options = {}) {
  const found = new Map();
  if (!trustedOwner(issue, ownerLogin) || !/^\[APPROVED BUFFER MIGRATION\]/.test(issue.title || '')) return found;
  const approval = headers(issue.body);
  if (approval?.MIGRATION_ID !== MIGRATION_ID || approval.MANIFEST_BLOB_SHA !== EXPECTED_MANIFEST_BLOB_SHA
    || approval.SOURCE_SNAPSHOT_ISSUE !== '381' || approval.PLAN_SELFTEST_ISSUE !== '382' || approval.APPLY !== 'YES') return found;
  const bytes = options.manifestBytes || fs.readFileSync(path.join(__dirname, '..', MANIFEST_PATH));
  const manifest = pinnedManifest(bytes);
  const { intents, applied, invalid } = migrationMarkers(comments, issue.number);
  for (const row of manifest.placements.filter(row => row.decision === 'REPURPOSE')) {
    const key = row.id + '@' + row.revision + ':' + row.target;
    const intent = intents.get(key), done = applied.get(key);
    if (invalid.has(key) || intent?.action !== 'REPURPOSE' || done?.action !== 'REPURPOSE'
      || intent.bufferId !== done.bufferId || intent.recovery !== done.recovery) continue;
    const source = options.approvalIssues?.find(item => item.number === row.approvalIssue);
    const sourceHeaders = headers(source?.body);
    if (!trustedOwner(source, ownerLogin) || !source.title.startsWith('[APPROVED LINKEDIN]')
      || !source.title.endsWith(row.title) || sourceHeaders?.POST_ID !== row.id
      || sourceHeaders.REVISION !== String(row.revision) || sourceHeaders.TARGETS !== row.target
      || sourceHeaders.MODE !== 'schedule' || sourceHeaders.CONTENT_QA !== 'PASS'
      || Date.parse(sourceHeaders.SCHEDULE_AT) !== Date.parse(row.bufferDueAt)) continue;
    const accepted = new Set();
    for (const receipt of options.commentsByIssue?.get(row.approvalIssue) || []) {
      if (!trustedReceipt(receipt, row.approvalIssue)) continue;
      for (const line of String(receipt.body || '').split(/\r?\n/)) {
        const match = /^- ([a-z0-9-]+)@(\d+) · .+?: Buffer post ID `([^`]+)`\s+(?:—|\|)\s+([^\s|]+)(?:\s+\|.*)?$/.exec(line);
        if (match?.[1] === row.id && match[2] === String(row.revision) && Date.parse(match[4]) === Date.parse(row.bufferDueAt)) accepted.add(match[3]);
      }
    }
    if (accepted.size !== 1 || !accepted.has(done.bufferId)) continue;
    found.set(done.bufferId, { issueNumber: issue.number, evidenceUrl: done.evidenceUrl, kind: 'repurpose', key, manifestBlobSha: EXPECTED_MANIFEST_BLOB_SHA });
  }
  return found;
}

module.exports = { isRemovalRequest, parseCompletedCleanup, parseCompletedRepurpose, pinnedManifest, trustedOwner, trustedReceipt };
