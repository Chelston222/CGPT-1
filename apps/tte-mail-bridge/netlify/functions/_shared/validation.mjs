import { CORPORATE_TYPES, INDIVIDUALISH_TYPES, PROVIDER_PERMISSION_BASES, REQUIRED_OPT_OUT } from './constants.mjs';
import { validateEmailRevenueOs } from './email-revenue-os.mjs';
import { normalizeEmail, safeText } from './util.mjs';

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const EXTERNAL_GATE_PROFILES = new Set(['COLD_B2B', 'WARM_REQUESTED', 'APPOINTMENT', 'CLIENT_LIFECYCLE']);
const PROFILE_MAX_AGE_MINUTES = Object.freeze({
  COLD_B2B: 72 * 60,
  WARM_REQUESTED: 60,
  APPOINTMENT: 30,
  CLIENT_LIFECYCLE: 60,
});

export function validateEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

function validateEmailGate(input, errors) {
  const raw = input?.emailGate || {};
  const profile = String(raw.profile || '').trim().toUpperCase();
  const gateRef = safeText(raw.gateRef, 500);
  const addressGate = String(raw.addressGate || '').trim().toUpperCase();
  const senderGate = String(raw.senderGate || '').trim().toUpperCase();
  const finalPermission = String(raw.finalPermission || '').trim().toUpperCase();
  const authorityEvidence = safeText(raw.authorityEvidence, 1000);
  const verifiedAtRaw = String(raw.verifiedAt || '');
  const verifiedAtMs = Date.parse(verifiedAtRaw);
  const evidenceScore = Number(raw.evidenceScore);
  const internal = profile === 'INTERNAL_OPERATIONAL';

  if (!profile) errors.push('email_gate_profile_required');
  else if (!internal && !EXTERNAL_GATE_PROFILES.has(profile)) errors.push('unsupported_email_gate_profile');

  if (!gateRef) errors.push('deliverability_gate_ref_required');
  if (!authorityEvidence || authorityEvidence.length < 3) errors.push('email_gate_authority_evidence_required');
  if (!Number.isFinite(verifiedAtMs)) errors.push('email_gate_verified_at_required');
  else if (verifiedAtMs > Date.now() + 5 * 60 * 1000) errors.push('email_gate_verified_at_in_future');

  if (internal) {
    if (finalPermission !== 'INTERNAL ONLY') errors.push('internal_email_gate_permission_required');
  } else if (EXTERNAL_GATE_PROFILES.has(profile)) {
    if (addressGate !== 'PASS') errors.push('address_gate_pass_required');
    if (senderGate !== 'PASS') errors.push('sender_gate_pass_required');
    if (finalPermission !== 'EMAIL ALLOWED') errors.push('final_email_permission_required');
    if (Number.isFinite(verifiedAtMs)) {
      const maxAgeMinutes = PROFILE_MAX_AGE_MINUTES[profile];
      if (Date.now() - verifiedAtMs > maxAgeMinutes * 60 * 1000) errors.push('email_gate_snapshot_stale');
    }
    if (profile === 'COLD_B2B' && (!Number.isFinite(evidenceScore) || evidenceScore < 90)) {
      errors.push('cold_b2b_evidence_score_below_90');
    }
  }

  return {
    ...raw,
    profile,
    gateRef,
    addressGate,
    senderGate,
    finalPermission,
    authorityEvidence,
    evidenceScore: Number.isFinite(evidenceScore) ? evidenceScore : null,
    verifiedAt: Number.isFinite(verifiedAtMs) ? new Date(verifiedAtMs).toISOString() : verifiedAtRaw,
  };
}

export function validateOutbound(input, opts = {}) {
  const errors = [];
  const toRaw = Array.isArray(input?.to) ? input.to : [input?.to].filter(Boolean);
  if (toRaw.length !== 1) errors.push('exactly_one_recipient_required');
  const to = validateEmail(toRaw[0]);
  if (!to) errors.push('invalid_recipient');
  const subject = safeText(input?.subject, opts.subjectMax || 180);
  if (!subject || /[\r\n]/.test(String(input?.subject || ''))) errors.push('invalid_subject');
  const text = String(input?.text || '');
  if (!text || text.length > (opts.bodyMax || 12000)) errors.push('invalid_body');
  if (!text.includes(REQUIRED_OPT_OUT)) errors.push('mandatory_opt_out_missing');
  if (!input?.leadId) errors.push('lead_id_required');
  if (!Number.isInteger(Number(input?.touchNo)) || Number(input.touchNo) < 1) errors.push('valid_touch_no_required');
  if (!input?.idempotencyKey) errors.push('idempotency_key_required');

  const emailGate = validateEmailGate(input, errors);
  const compliance = input?.compliance || {};
  const companyType = String(compliance.companyType || '').toLowerCase();
  const legalBasis = String(compliance.legalBasis || '').toLowerCase();
  const recipientPermission = String(compliance.recipientPermission || '').toLowerCase();
  const permissionEvidence = safeText(compliance.permissionEvidence, 500);
  const permissionRecordedAtRaw = String(compliance.permissionRecordedAt || '');
  const permissionRecordedAtMs = Date.parse(permissionRecordedAtRaw);
  const reviewed = String(input?.reviewState || '').toUpperCase() === 'APPROVED' && Boolean(input?.reviewedBy);
  const firstTouch = Number(input?.touchNo) === 1;

  if (!companyType) errors.push('company_type_required');
  if (companyType === 'unknown') errors.push('uncertain_legal_category_blocked');
  if (CORPORATE_TYPES.has(companyType)) {
    if (!['legitimate_interests', 'consent'].includes(legalBasis)) errors.push('corporate_legal_basis_required');
  } else if (INDIVIDUALISH_TYPES.has(companyType)) {
    if (!['consent', 'soft_opt_in'].includes(legalBasis)) errors.push('individual_like_recipient_requires_consent_or_soft_opt_in');
  } else if (companyType) {
    errors.push('unsupported_company_type');
  }

  if (!PROVIDER_PERMISSION_BASES.has(recipientPermission)) errors.push('provider_permission_required');
  if (!permissionEvidence || permissionEvidence.length < 3) errors.push('permission_evidence_required');
  if (!Number.isFinite(permissionRecordedAtMs)) errors.push('permission_recorded_at_required');
  else if (permissionRecordedAtMs > Date.now() + 5 * 60 * 1000) errors.push('permission_recorded_at_in_future');

  if (firstTouch && opts.requireFirstTouchReview !== false && !reviewed) errors.push('first_touch_human_approval_required');
  if (!firstTouch && opts.requireSequenceApproval !== false && !reviewed && input?.sequenceApproved !== true) errors.push('follow_up_sequence_approval_required');

  const emailRevenueOs = validateEmailRevenueOs(input, {
    ...(opts.emailRevenueOs || {}),
    requireHumanReview: opts.requireFirstTouchReview !== false || opts.requireSequenceApproval !== false,
  });
  errors.push(...emailRevenueOs.errors);

  const normalized = {
    ...input,
    to: to ? [to] : [],
    subject,
    text,
    emailGate,
    compliance: {
      ...compliance,
      companyType,
      legalBasis,
      recipientPermission,
      permissionEvidence,
      permissionRecordedAt: Number.isFinite(permissionRecordedAtMs)
        ? new Date(permissionRecordedAtMs).toISOString()
        : permissionRecordedAtRaw,
    },
  };

  if (emailRevenueOs.applied) normalized.emailRevenueOs = emailRevenueOs.normalized;

  return {
    ok: errors.length === 0,
    errors,
    warnings: emailRevenueOs.warnings,
    normalized,
  };
}
