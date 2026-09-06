'use strict';

const LEDGER_TITLE = '[BUFFER ACCEPTANCE LEDGER] LinkedIn governed releases';
const ACCEPTED_PATTERN = /<!--\s*BUFFER_ACCEPTED\s+([^\s]+)\s+bufferId=([^\s>]+)(?:\s+dueAt=([^\s>]+))?\s*-->/g;
const INTENT_PATTERN = /<!--\s*BUFFER_DISPATCH_INTENT\s+([^\s>]+)\s*-->/g;

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

function trustedBodies(comments = [], trustedLogin = 'github-actions[bot]') {
  return comments.flatMap((comment) => {
    if (typeof comment === 'string') return [comment];
    return comment.user?.login === trustedLogin ? [String(comment.body || '')] : [];
  });
}

function parseAcceptanceEntries(comments = [], trustedLogin = 'github-actions[bot]') {
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

function parseIntentKeys(comments = [], trustedLogin = 'github-actions[bot]') {
  const keys = new Set();
  for (const body of trustedBodies(comments, trustedLogin)) {
    for (const match of body.matchAll(INTENT_PATTERN)) keys.add(match[1]);
  }
  return keys;
}

function acceptedKeys(comments = [], trustedLogin = 'github-actions[bot]') {
  return new Set(parseAcceptanceEntries(comments, trustedLogin).keys());
}

function unresolvedIntentKeys(comments = [], trustedLogin = 'github-actions[bot]') {
  const intents = parseIntentKeys(comments, trustedLogin);
  const accepted = acceptedKeys(comments, trustedLogin);
  return new Set([...intents].filter((key) => !accepted.has(key)));
}

function dispatchIntentComment({ key, queueId, revision, targetName, target }) {
  return [
    '⏳ Buffer dispatch intent recorded before mutation.',
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

module.exports = {
  ACCEPTED_PATTERN,
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
  unresolvedIntentKeys,
};
