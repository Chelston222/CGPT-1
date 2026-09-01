import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOutbound } from '../netlify/functions/_shared/validation.mjs';
import { REQUIRED_OPT_OUT } from '../netlify/functions/_shared/constants.mjs';

function base(overrides = {}) {
  return {
    to: ['owner@example.co.uk'],
    subject: 'A client-return question',
    text: `Useful factual message.\n\n${REQUIRED_OPT_OUT}`,
    leadId: 'ERO-1',
    touchNo: 1,
    idempotencyKey: 'ERO-1|1',
    reviewState: 'APPROVED',
    reviewedBy: 'test',
    compliance: {
      companyType: 'corporate',
      legalBasis: 'consent',
      recipientPermission: 'consent',
      permissionEvidence: 'Test consent evidence',
      permissionRecordedAt: '2026-08-30T08:00:00Z',
    },
    ...overrides,
  };
}

function owned(overrides = {}) {
  return {
    channelContext: 'owned',
    ctaMode: 'NONE',
    primaryCtaCount: 0,
    qaScore: 95,
    hardFails: [],
    releaseState: 'READY',
    ...overrides,
  };
}

function cold(overrides = {}) {
  return {
    channelContext: 'cold_b2b',
    ctaMode: 'SOFT',
    primaryCtaCount: 1,
    qaScore: 95,
    hardFails: [],
    releaseState: 'READY',
    leadIdentificationState: 'GREEN',
    namedResponsiblePerson: 'Alex Owner',
    providerPermissionEvidence: 'Test consent evidence',
    suppressionState: 'CLEAR',
    senderHealthGate: 'GREEN',
    humanReviewState: 'APPROVED',
    legalContactRouteClassification: 'corporate',
    ...overrides,
  };
}

test('legacy untagged valid payload remains backwards compatible', () => {
  assert.equal(validateOutbound(base()).ok, true);
});

test('valid owned Email Revenue OS payload passes', () => {
  assert.equal(validateOutbound(base({ emailRevenueOs: owned() })).ok, true);
});

test('canonical brand spacing is enforced', () => {
  const result = validateOutbound(base({ subject: 'A 222 Emails question', emailRevenueOs: owned() }));
  assert.ok(result.errors.includes('email_os_noncanonical_brand_spacing'));
});

test('current-facing em dash fails', () => {
  const result = validateOutbound(base({ subject: 'The appointment — and what happens next', emailRevenueOs: owned() }));
  assert.ok(result.errors.includes('email_os_em_dash_blocked'));
});

test('current-facing Jotform route fails', () => {
  const result = validateOutbound(base({ text: `See https://form.jotform.com/123.\n\n${REQUIRED_OPT_OUT}`, emailRevenueOs: owned() }));
  assert.ok(result.errors.includes('email_os_current_public_jotform_blocked'));
});

test('superseded formal system name fails', () => {
  const result = validateOutbound(base({ text: `Our Revenue Recovery System helps.\n\n${REQUIRED_OPT_OUT}`, emailRevenueOs: owned() }));
  assert.ok(result.errors.includes('email_os_superseded_formal_system_name'));
});

test('more than one primary CTA fails', () => {
  const result = validateOutbound(base({ emailRevenueOs: owned({ ctaMode: 'DIAGNOSTIC', primaryCtaCount: 2 }) }));
  assert.ok(result.errors.includes('email_os_multiple_primary_ctas_blocked'));
});

test('CTA NONE cannot contain a primary CTA', () => {
  const result = validateOutbound(base({ emailRevenueOs: owned({ primaryCtaCount: 1 }) }));
  assert.ok(result.errors.includes('email_os_cta_none_conflicts_with_primary_cta'));
});

test('READY below QA floor fails', () => {
  const result = validateOutbound(base({ emailRevenueOs: owned({ qaScore: 89 }) }));
  assert.ok(result.errors.includes('email_os_ready_below_qa_threshold'));
});

test('flagship READY requires 95 and 95 passes', () => {
  const fail = validateOutbound(base({ emailRevenueOs: owned({ qaScore: 94, flagship: true }) }));
  const pass = validateOutbound(base({ emailRevenueOs: owned({ qaScore: 95, flagship: true }) }));
  assert.ok(fail.errors.includes('email_os_ready_below_qa_threshold'));
  assert.equal(pass.ok, true);
});

test('READY with hard fails is blocked', () => {
  const result = validateOutbound(base({ emailRevenueOs: owned({ hardFails: ['truth'] }) }));
  assert.ok(result.errors.includes('email_os_ready_with_hard_fails'));
});

test('cold B2B requires GREEN Lead Identification', () => {
  const result = validateOutbound(base({ emailRevenueOs: cold({ leadIdentificationState: 'AMBER' }) }));
  assert.ok(result.errors.includes('email_os_cold_requires_green_lead_identification'));
});

test('cold B2B requires named responsible person', () => {
  const result = validateOutbound(base({ emailRevenueOs: cold({ namedResponsiblePerson: '' }) }));
  assert.ok(result.errors.includes('email_os_cold_requires_named_responsible_person'));
});

test('cold B2B requires clear suppression state', () => {
  const result = validateOutbound(base({ emailRevenueOs: cold({ suppressionState: 'UNKNOWN' }) }));
  assert.ok(result.errors.includes('email_os_cold_requires_clear_suppression_state'));
});

test('cold B2B requires healthy sender gate', () => {
  const result = validateOutbound(base({ emailRevenueOs: cold({ senderHealthGate: 'RED' }) }));
  assert.ok(result.errors.includes('email_os_cold_requires_sender_health_gate'));
});

test('cold B2B final validation requires human approval', () => {
  const result = validateOutbound(base({ reviewState: 'DRAFT', reviewedBy: null, emailRevenueOs: cold({ humanReviewState: 'DRAFT' }) }));
  assert.ok(result.errors.includes('first_touch_human_approval_required'));
  assert.ok(result.errors.includes('email_os_cold_requires_human_review'));
});

test('cold B2B draft may enter the human-review queue validation phase', () => {
  const result = validateOutbound(
    base({ reviewState: 'DRAFT', reviewedBy: null, emailRevenueOs: cold({ releaseState: 'DRAFT', humanReviewState: 'DRAFT' }) }),
    { requireFirstTouchReview: false, requireSequenceApproval: false },
  );
  assert.equal(result.ok, true);
});

test('top-level approved review state is authoritative over stale draft metadata', () => {
  const result = validateOutbound(base({ emailRevenueOs: cold({ humanReviewState: 'DRAFT' }) }));
  assert.equal(result.ok, true);
});

test('WINNER or CORE requires performance evidence', () => {
  const result = validateOutbound(base({ emailRevenueOs: owned({ performanceState: 'WINNER' }) }));
  assert.ok(result.errors.includes('email_os_winner_or_core_requires_evidence'));
});

test('SENT state requires external-event evidence', () => {
  const result = validateOutbound(base({ emailRevenueOs: owned({ externalEventState: 'SENT' }) }));
  assert.ok(result.errors.includes('email_os_external_state_requires_event_evidence'));
});

test('creator imitation flag is blocked', () => {
  const result = validateOutbound(base({ emailRevenueOs: owned({ creatorReference: 'example', creatorImitation: true }) }));
  assert.ok(result.errors.includes('email_os_creator_imitation_blocked'));
});

test('identical subject and preheader warns but does not hard fail', () => {
  const result = validateOutbound(base({ emailRevenueOs: owned({ preheader: 'A client-return question' }) }));
  assert.equal(result.ok, true);
  assert.ok(result.warnings.includes('email_os_preheader_repeats_subject'));
});

test('valid Email Revenue OS cold payload passes all additive gates', () => {
  assert.equal(validateOutbound(base({ emailRevenueOs: cold() })).ok, true);
});
