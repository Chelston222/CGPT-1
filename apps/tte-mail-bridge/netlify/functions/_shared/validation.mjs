import { CORPORATE_TYPES, INDIVIDUALISH_TYPES, PROVIDER_PERMISSION_BASES, REQUIRED_OPT_OUT } from './constants.mjs';
import { validateEmailRevenueOs } from './email-revenue-os.mjs';
import { normalizeEmail, safeText } from './util.mjs';

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const EMAIL_GATE_VERSION = 'DELIVERABILITY-1.0-20261003';
const EMAIL_GATE_PROFILES = new Set(['COLD_B2B','WARM_REQUESTED','APPOINTMENT','CLIENT_LIFECYCLE','INTERNAL_OPERATIONAL']);
const EMAIL_GATE_FINAL = {
  COLD_B2B: 'EMAIL ALLOWED',
  WARM_REQUESTED: 'REQUESTED EMAIL ALLOWED',
  APPOINTMENT: 'APPOINTMENT EMAIL ALLOWED',
  CLIENT_LIFECYCLE: 'CLIENT SEND ALLOWED',
  INTERNAL_OPERATIONAL: 'INTERNAL ONLY',
};
const EMAIL_GATE_MAX_AGE_MS = {
  COLD_B2B: 72 * 60 * 60 * 1000,
  WARM_REQUESTED: 72 * 60 * 60 * 1000,
  APPOINTMENT: 24 * 60 * 60 * 1000,
  CLIENT_LIFECYCLE: 24 * 60 * 60 * 1000,
  INTERNAL_OPERATIONAL: 24 * 60 * 60 * 1000,
};

export function validateEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

function validateEmailGate(input, errors) {
  const gate = input?.emailGate || {};
  const profile = String(gate.profile || '').toUpperCase();
  const gateVersion = String(gate.gateVersion || '');
  const deliverabilityGateRef = safeText(gate.deliverabilityGateRef, 240);
  const addressGate = String(gate.addressGate || '').toUpperCase();
  const senderGate = String(gate.senderGate || '').toUpperCase();
  const finalEmailPermission = String(gate.finalEmailPermission || '').toUpperCase();
  const verifiedAtRaw = String(gate.verifiedAt || '');
  const verifiedAtMs = Date.parse(verifiedAtRaw);
  const expiresAtRaw = String(gate.expiresAt || '');
  const expiresAtMs = expiresAtRaw ? Date.parse(expiresAtRaw) : NaN;
  const evidenceScore = Number(gate.evidenceScore);

  if (!EMAIL_GATE_PROFILES.has(profile)) errors.push('email_gate_profile_required');
  if (gateVersion !== EMAIL_GATE_VERSION) errors.push('email_gate_version_mismatch');
  if (!deliverabilityGateRef || deliverabilityGateRef.length < 3) errors.push('deliverability_gate_ref_required');

  if (profile === 'INTERNAL_OPERATIONAL') {
    if (addressGate !== 'INTERNAL') errors.push('internal_email_gate_requires_internal_address_state');
    if (senderGate !== 'INTERNAL') errors.push('internal_email_gate_requires_internal_sender_state');
  } else if (EMAIL_GATE_PROFILES.has(profile)) {
    if (addressGate !== 'PASS') errors.push('email_address_gate_not_pass');
    if (senderGate !== 'PASS') errors.push('email_sender_gate_not_pass');
  }

  if (EMAIL_GATE_PROFILES.has(profile) && finalEmailPermission !== EMAIL_GATE_FINAL[profile]) {
    errors.push('final_email_permission_not_authorised');
  }

  if (!Number.isFinite(verifiedAtMs)) errors.push('email_gate_verified_at_required');
  else {
    const age = Date.now() - verifiedAtMs;
    if (age < -5 * 60 * 1000) errors.push('email_gate_verified_at_in_future');
    const maxAge = EMAIL_GATE_MAX_AGE_MS[profile];
    if (Number.isFinite(maxAge) && age > maxAge) errors.push('email_gate_stale');
  }

  if (expiresAtRaw) {
    if (!Number.isFinite(expiresAtMs)) errors.push('email_gate_expires_at_invalid');
    else if (expiresAtMs <= Date.now()) errors.push('email_gate_expired');
  }

  if (profile === 'COLD_B2B' && (!Number.isFinite(evidenceScore) || evidenceScore < 90)) {
    errors.push('cold_b2b_evidence_score_below_90');
  }

  if (input?.allowSenderSwitch === true && profile !== 'INTERNAL_OPERATIONAL') {
    errors.push('sender_switch_bypass_forbidden');
  }

  return {
    ...gate,
    profile,
    gateVersion,
    deliverabilityGateRef,
    addressGate,
    senderGate,
    finalEmailPermission,
    verifiedAt: Number.isFinite(verifiedAtMs) ? new Date(verifiedAtMs).toISOString() : verifiedAtRaw,
    expiresAt: Number.isFinite(expiresAtMs) ? new Date(expiresAtMs).toISOString() : expiresAtRaw,
    evidenceScore: Number.isFinite(evidenceScore) ? evidenceScore : gate.evidenceScore,
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
