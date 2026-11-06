import { createHash } from 'node:crypto';

const MAX_SOURCE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_REVIEW_AGE_MS = 72 * 60 * 60 * 1000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function approvedMessageFingerprint({ subject, text }) {
  return createHash('sha256').update(`${String(subject || '')}\n${String(text || '')}`, 'utf8').digest('hex');
}

function normalise(value) {
  return String(value || '').toLocaleLowerCase('en-GB').replace(/\s+/g, ' ').trim();
}

function validDate(value, nowMs, maxAgeMs) {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) && time <= nowMs + MAX_FUTURE_CLOCK_SKEW_MS && nowMs - time <= maxAgeMs;
}

function validSourceUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}

// Required on EVERY COLD_B2B message at intake, approval AND final dispatch.
// Static checks cannot prove an external page's truth or that an individual
// named reviewer was a human. Both require verified operating evidence.
export function validateColdPreAudit(input, { nowMs = Date.now() } = {}) {
  const profile = String(input?.emailGate?.profile || '').trim().toUpperCase();
  if (profile !== 'COLD_B2B') return [];

  const audit = input?.preAudit;
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) return ['preaudit_required'];
  const errors = [];
  const recipient = Array.isArray(input?.to) ? input.to[0] : input?.to;
  const text = String(input?.text || '');

  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{5,99}$/.test(String(audit.auditId || ''))) errors.push('preaudit_id_required');
  if (!input?.leadId || String(audit.leadId || '') !== String(input.leadId)) errors.push('preaudit_lead_id_mismatch');
  if (!Number.isInteger(Number(input?.touchNo)) || Number(audit.touchNo) !== Number(input.touchNo)) errors.push('preaudit_touch_no_mismatch');
  if (!recipient || normalise(audit.recipient) !== normalise(recipient)) errors.push('preaudit_recipient_mismatch');
  if (audit.evidenceType !== 'OBSERVED') errors.push('preaudit_observed_evidence_required');
  if (!validSourceUrl(audit.sourceUrl)) errors.push('preaudit_source_url_required');
  if (!validDate(audit.checkedAt, nowMs, MAX_SOURCE_AGE_MS)) errors.push('preaudit_source_stale_or_missing');

  const finding = normalise(audit.observedFinding);
  const risk = normalise(audit.commercialRisk);
  const fix = normalise(audit.recommendedFix);
  if (finding.length < 30) errors.push('preaudit_specific_finding_required');
  if (risk.length < 25) errors.push('preaudit_hypothetical_consequence_required');
  if (fix.length < 25) errors.push('preaudit_specific_fix_required');
  const observationAnchor = normalise(audit.observationAnchor);
  const fixAnchor = normalise(audit.fixAnchor);
  const message = normalise(text);
  if (observationAnchor.length < 12 || !finding.includes(observationAnchor) || !message.includes(observationAnchor)) {
    errors.push('preaudit_finding_missing_from_message');
  }
  if (fixAnchor.length < 12 || !fix.includes(fixAnchor) || !message.includes(fixAnchor)) {
    errors.push('preaudit_fix_missing_from_message');
  }

  if (!validDate(audit.reviewedAt, nowMs, MAX_REVIEW_AGE_MS) || !String(audit.reviewedBy || '').trim()) {
    errors.push('preaudit_recent_human_review_required');
  }
  if (audit.humanReviewPass !== true) errors.push('preaudit_human_review_pass_required');
  if (audit.proofAttributionReviewPass !== true) errors.push('preaudit_proof_attribution_review_required');
  const reviewedAtMs = Date.parse(String(audit.reviewedAt || ''));
  const checkedAtMs = Date.parse(String(audit.checkedAt || ''));
  if (Number.isFinite(reviewedAtMs) && Number.isFinite(checkedAtMs) && reviewedAtMs + MAX_FUTURE_CLOCK_SKEW_MS < checkedAtMs) {
    errors.push('preaudit_review_precedes_observation');
  }

  if (String(audit.approvedMessageSha256 || '').toLowerCase() !== approvedMessageFingerprint(input)) {
    errors.push('preaudit_approved_copy_fingerprint_mismatch');
  }

  const normalisedMoney = message.replace(/,/g, '');
  const hasBefore = /£\s*15(?:000|k)\b/.test(normalisedMoney);
  const hasAfter = /£\s*25(?:000|k)\b/.test(normalisedMoney);
  if (hasBefore && hasAfter && !/\b(?:four|4)\s+months\b/.test(message)) {
    errors.push('preaudit_case_four_month_timeframe_required');
  }
  if (hasBefore && hasAfter && /\b(?:by implementing|because we implemented|through implementing)\b/.test(message)
      && audit.historicalMechanismVerified !== true) {
    errors.push('preaudit_unverified_case_causation');
  }

  return [...new Set(errors)];
}
