'use strict';

const LEDGER_TITLE = '[BUFFER ACCEPTANCE LEDGER] LinkedIn governed releases';
const ACCEPTED_PATTERN = /<!--\s*BUFFER_ACCEPTED\s+([^\s]+)\s+bufferId=([^\s>]+)(?:\s+dueAt=([^\s>]+))?\s*-->/g;
const INTENT_PATTERN = /<!--\s*BUFFER_DISPATCH_INTENT\s+([^\s>]+)\s*-->/g;
const ACTIONS_BOT_LOGIN = 'github-actions[bot]';

function acceptanceKey(postId, revision, target) {
  return `${postId}@${revision}:${target}`;
}

function acceptanceMarker({ key, bufferId, dueAt = null }) {
  if (!key || !bufferId) throw new Error('Acceptance marker requires key and bufferId.');
  return `<!-- BUFFER_ACCEPTED ${key} bufferId=${bufferId}${dueAt ? ` dueAt=${dueAt}` : ''} -->`;
}

function dispatchIntentMarker(key) {
  if (!key) throw new Error('Dispatch intent requires a placement key.');
  return `<!-- BUFFER_DISPATCH_INTENT ${key} -->`;
}

function trustedBodies(comments = [], trustedLogin = ACTIONS_BOT_LOGIN) {
  return comments.flatMap((comment) => {
    if (typeof comment === 'string') return [comment];
    return comment.user?.login === trustedLogin ? [String(comment.body || '')] : [];
  });
}

function parseAcceptanceEntries(comments = [], trustedLogin = ACTIONS_BOT_LOGIN) {
  const entries = new Map();
  for (const body of trustedBodies(comments, trustedLogin)) {
    for (const match of body.matchAll(ACCEPTED_PATTERN)) {
      const [_, key, bufferId, dueAt] = match;
      if (!entries.has(key)) entries.set(key, { key, bufferId, dueAt: dueAt || null });
      else {
        const current = entries.get(key);
        if (current.bufferId !== bufferId) throw new Error(`Acceptance ledger conflict for ${key}: ${current.bufferId} vs ${bufferId}.`);
      }
    }
  }
  return entries;
}

function parseIntentKeys(comments = [], trustedLogin = ACTIONS_BOT_LOGIN) {
  const keys = new Set();
  for (const body of trustedBodies(comments, trustedLogin)) {
    for (const match of body.matchAll(INTENT_PATTERN)) keys.add(match[1]);
  }
  return keys;
}

function acceptedKeys(comments = [], trustedLogin = ACTIONS_BOT_LOGIN) {
  return new Set(parseAcceptanceEntries(comments, trustedLogin).keys());
}

function unresolvedIntentKeys(comments = [], trustedLogin = ACTIONS_BOT_LOGIN) {
  const intents = parseIntentKeys(comments, trustedLogin);
  const accepted = acceptedKeys(comments, trustedLogin);
  return new Set([...intents].filter((key) => !accepted.has(key)));
}

function selectTrustedLedgerIssue(issues = [], ownerLogin) {
  const owner = String(ownerLogin || '').trim();
  if (!owner) throw new Error('Repository owner login is required to select the Buffer acceptance ledger.');
  const trustedCreators = new Set([owner, ACTIONS_BOT_LOGIN]);
  const matches = issues.filter((issue) => !issue.pull_request
    && issue.title === LEDGER_TITLE
    && trustedCreators.has(issue.user?.login));
  if (matches.length > 1) {
    throw new Error(`Multiple trusted Buffer acceptance ledgers exist (${matches.map((issue) => `#${issue.number}`).join(', ')}). Refusing split-brain idempotency state.`);
  }
  return matches[0] || null;
}

function dispatchIntentComment({ key, queueId, revision, targetName, target }) {
  return [
    '⏳ Buffer dispatch intent recorded before provider write.',
    '',
    `- ${queueId}@${revision} · ${targetName}`,
    `- Placement key: \`${key}\``,
    `- Target: **${target}**`,
    '- If this intent does not acquire a matching BUFFER_ACCEPTED marker, automatic recreation must stop until Buffer is reconciled.',
    '',
    dispatchIntentMarker(key),
  ].join('\n');
}

function acceptanceComment({ key, queueId, revision, targetName, target, bufferId, dueAt = null, mediaProof = null }) {
  return [
    '✅ Buffer destination accepted and durably recorded.',
    '',
    `- ${queueId}@${revision} · ${targetName}: Buffer post ID \`${bufferId}\`${dueAt ? ` | ${dueAt}` : ''}${mediaProof ? ` | media ${mediaProof.bytes} bytes / SHA-256 ${mediaProof.sha256}` : ''}`,
    `- Placement key: \`${key}\``,
    `- Target: **${target}**`,
    '',
    acceptanceMarker({ key, bufferId, dueAt }),
  ].join('\n');
}


// Publication/health readers share one trusted, de-duplicated receipt contract.
// A missing or conflicting date remains unknown; it must not make health green.
function parseAcceptanceRows(comments = [], trustedLogin = ACTIONS_BOT_LOGIN) {
  const rows = new Map();
  function add(row) {
    const prior = rows.get(row.bufferId);
    if (!prior) { rows.set(row.bufferId, row); return; }
    if (prior.dueAt && row.dueAt && Date.parse(prior.dueAt) !== Date.parse(row.dueAt)) prior.scheduleConflict = true;
    if (!prior.dueAt && row.dueAt) prior.dueAt = row.dueAt;
    if (Number.isFinite(row.acceptedAt)) prior.acceptedAt = Number.isFinite(prior.acceptedAt) ? Math.min(prior.acceptedAt, row.acceptedAt) : row.acceptedAt;
  }
  for (const comment of comments) {
    if (comment?.user?.login !== trustedLogin) continue;
    const body = String(comment.body || '');
    const acceptedAt = Date.parse(comment.created_at || comment.updated_at || '');
    for (const m of body.matchAll(ACCEPTED_PATTERN)) add({label:m[1],bufferId:m[2],dueAt:m[3] || null,acceptedAt,source:'approval_issue'});
    const legacy = /^-\s+([^\n:]+?):\s+Buffer post ID\s+`([^`]+)`(?:\s+(?:\u2014|\|)\s+([^\s\n|]+))?/gm;
    for (const m of body.matchAll(legacy)) add({label:m[1].trim(),bufferId:m[2],dueAt:m[3] || null,acceptedAt,source:'approval_issue'});
  }
  return [...rows.values()].map(row => ({...row, dueAt: row.scheduleConflict ? null : row.dueAt}));
}

const { isRemovalRequest, parseCompletedCleanup, parseCompletedRepurpose } = require('./linkedin-buffer-removal-receipts.cjs');


function validAnalyticsCaptureIds(comments = []) {
  const body = comments.filter(comment => comment?.user?.login === ACTIONS_BOT_LOGIN)
    .map(comment => String(comment.body || '')).join('\n');
  const publicationTimes = new Map();
  for (const match of body.matchAll(/<!-- LINKEDIN_PUBLICATION_VERIFIED bufferId=([^\s>]+)(?: sentAt=([^\s>]+))?/g)) {
    const timestamp = Date.parse(match[2] || '');
    if (!publicationTimes.has(match[1])) publicationTimes.set(match[1], timestamp);
    else if (publicationTimes.get(match[1]) !== timestamp) publicationTimes.set(match[1], NaN);
  }
  return new Set([...body.matchAll(/<!-- LINKEDIN_ANALYTICS_CAPTURED bufferId=([^\s>]+) metricsUpdatedAt=([^\s>]+)/g)]
    .filter(match => Number.isFinite(publicationTimes.get(match[1])) && Date.parse(match[2]) >= publicationTimes.get(match[1]))
    .map(match => match[1]));
}

module.exports = {
  validAnalyticsCaptureIds,
  parseAcceptanceRows,
  parseCompletedCleanup,
  parseCompletedRepurpose,
  isRemovalRequest,
  ACCEPTED_PATTERN,
  ACTIONS_BOT_LOGIN,
  INTENT_PATTERN,
  LEDGER_TITLE,
  acceptanceComment,
  acceptanceKey,
  acceptanceMarker,
  acceptedKeys,
  dispatchIntentComment,
  dispatchIntentMarker,
  parseAcceptanceEntries,
  parseIntentKeys,
  selectTrustedLedgerIssue,
  unresolvedIntentKeys,
};

