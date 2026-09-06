'use strict';

const LEDGER_TITLE = '[BUFFER ACCEPTANCE LEDGER] LinkedIn governed releases';
const MARKER_PATTERN = /<!--\s*BUFFER_ACCEPTED\s+([^\s]+)\s+bufferId=([^\s>]+)(?:\s+dueAt=([^\s>]+))?\s*-->/g;

function acceptanceKey(postId, revision, target) {
  return `${postId}@${revision}:${target}`;
}

function acceptanceMarker({ key, bufferId, dueAt = null }) {
  if (!key || !bufferId) throw new Error('Acceptance marker requires key and bufferId.');
  return `<!-- BUFFER_ACCEPTED ${key} bufferId=${bufferId}${dueAt ? ` dueAt=${dueAt}` : ''} -->`;
}

function parseAcceptanceEntries(comments = [], trustedLogin = 'github-actions[bot]') {
  const entries = new Map();
  for (const comment of comments) {
    if (typeof comment !== 'string' && comment.user?.login !== trustedLogin) continue;
    const body = typeof comment === 'string' ? comment : String(comment.body || '');
    for (const match of body.matchAll(MARKER_PATTERN)) {
      const [_, key, bufferId, dueAt] = match;
      if (!entries.has(key)) entries.set(key, { key, bufferId, dueAt: dueAt || null });
      else {
        const current = entries.get(key);
        if (current.bufferId !== bufferId) {
          throw new Error(`Acceptance ledger conflict for ${key}: ${current.bufferId} vs ${bufferId}.`);
        }
      }
    }
  }
  return entries;
}

function acceptedKeys(comments = [], trustedLogin = 'github-actions[bot]') {
  return new Set(parseAcceptanceEntries(comments, trustedLogin).keys());
}

function acceptanceComment({ key, queueId, revision, targetName, target, bufferId, dueAt = null, mediaProof = null }) {
  return [
    '✅ Buffer destination accepted and durably recorded.',
    '',
    `- ${queueId}@${revision} · ${targetName}: Buffer post ID \`${bufferId}\`${dueAt ? ` · ${dueAt}` : ''}${mediaProof ? ` · media ${mediaProof.bytes} bytes / SHA-256 ${mediaProof.sha256}` : ''}`,
    `- Placement key: \`${key}\``,
    `- Target: **${target}**`,
    '',
    acceptanceMarker({ key, bufferId, dueAt }),
  ].join('\n');
}

module.exports = {
  LEDGER_TITLE,
  acceptanceComment,
  acceptanceKey,
  acceptanceMarker,
  acceptedKeys,
  parseAcceptanceEntries,
};
