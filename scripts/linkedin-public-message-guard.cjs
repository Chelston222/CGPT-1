'use strict';

function normalise(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function publicText(queuePost = {}) {
  const copyValues = Object.values(queuePost.copy || {}).filter(Boolean);
  const channelCopy = Object.values(queuePost.copyByTarget || {}).filter(Boolean);
  return [
    queuePost.title,
    queuePost.documentTitle,
    queuePost.mediaAlt,
    queuePost.mediaAltText,
    ...copyValues,
    ...channelCopy,
  ].map(normalise).filter(Boolean).join('\n\n');
}

function evaluateCurrentPublicMessageGuard(queuePost, options = {}) {
  const phase = options.phase || 'dispatch';
  if (phase === 'history') {
    return { pass: true, reasons: [], phase, text: publicText(queuePost) };
  }

  const text = publicText(queuePost);
  const reasons = [];

  if (!text) reasons.push('Public copy is empty');
  if (/\bclient return fit check\b/i.test(text)) reasons.push('Retired Client Return Fit Check naming is present');
  if (/\bretention lab\b/i.test(text)) reasons.push('Retired Retention Lab public brand is present');
  if (/\b222 Emails\b/.test(text)) reasons.push('Written company name must be 222Emails, not 222 Emails');

  if (/\b(?:comment|dm|message|reply)\b[^\n.!?]{0,60}\b(?:fit(?:\s+check)?|revenue\s+recovery\s+check|recovery\s+check|rrc)\b/i.test(text)) {
    reasons.push('Keyword-gated access to the current free diagnostic is not allowed');
  }

  const freeDiagnosticPattern = /\b(?:free\s+)?(?:revenue\s+recovery\s+check|recovery\s+check|rrc)\b/i;
  const obligationText = text
    .replace(/\bno\s+(?:mandatory|required)\s+(?:discovery\s+)?(?:call|conversation)\b/gi, '')
    .replace(/\b(?:call|conversation)\s+(?:is|are)\s+not\s+(?:mandatory|required)\b/gi, '')
    .replace(/\b(?:do|does)\s+not\s+require\s+(?:a\s+)?(?:discovery\s+)?(?:call|conversation)\b/gi, '');
  const requiredConversationPattern = /\b(?:requires?|must|need(?:ed)?\s+to|have\s+to)\b[^\n.!?]{0,45}\b(?:call|conversation)\b|\b(?:mandatory|required)\s+(?:discovery\s+)?(?:call|conversation)\b|\b(?:call|conversation)\s+(?:is|are)\s+(?:mandatory|required)\b/i;
  if (freeDiagnosticPattern.test(text) && requiredConversationPattern.test(obligationText)) {
    reasons.push('The Free Revenue Recovery Check must not be framed as requiring a call or conversation');
  }

  if (/\bfit check\b/i.test(text)) reasons.push('Current-facing Fit Check wording is retired');

  return { pass: reasons.length === 0, reasons, phase, text };
}

function assertCurrentPublicMessageGuard(queuePost, options = {}) {
  const result = evaluateCurrentPublicMessageGuard(queuePost, options);
  if (!result.pass) {
    const id = queuePost?.id || 'queue item';
    const revision = queuePost?.revision == null ? '?' : queuePost.revision;
    const error = new Error(`${id}@${revision} failed current public message guard: ${result.reasons.join('; ')}`);
    error.publicMessageGuard = result;
    throw error;
  }
  return result;
}

module.exports = {
  assertCurrentPublicMessageGuard,
  evaluateCurrentPublicMessageGuard,
  normalise,
  publicText,
};
