import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOutbound } from '../netlify/functions/_shared/validation.mjs';
import { REQUIRED_OPT_OUT } from '../netlify/functions/_shared/constants.mjs';

const permission = {
  recipientPermission: 'consent',
  permissionEvidence: 'Regression-test consent evidence',
  permissionRecordedAt: '2026-08-24T08:00:00Z',
};

function prospectPayload(overrides = {}) {
  return {
    to: ['owner@example.co.uk'],
    subject: 'Revenue recovery question',
    text: `Useful factual message.\n\n${REQUIRED_OPT_OUT}`,
    leadId: 'REGRESSION-LEAD',
    touchNo: 1,
    touchType: 'initial',
    idempotencyKey: 'REGRESSION-LEAD|1',
    reviewState: 'APPROVED',
    reviewedBy: 'regression-test',
    compliance: {
      companyType: 'corporate',
      legalBasis: 'consent',
      ...permission,
    },
    ...overrides,
  };
}

test('24 Aug Jake-shaped prospect payload hard-fails before queue/provider when literal opt-out is absent', () => {
  const result = validateOutbound(prospectPayload({
    leadId: 'CALL-20260821-001',
    idempotencyKey: 'CALL-20260821-001|1',
    text: 'Hi Jake,\n\nI was looking at the client-return journey and noticed a narrow follow-up question.',
  }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('mandatory_opt_out_missing'));
});

test('24 Aug Cosmetic Aesthetics-shaped follow-up hard-fails when literal opt-out is absent', () => {
  const result = validateOutbound(prospectPayload({
    leadId: 'RRO-COSMETIC-AESTHETICS',
    touchNo: 2,
    touchType: 'value_follow_up',
    idempotencyKey: 'RRO-COSMETIC-AESTHETICS|2',
    sequenceApproved: true,
    text: 'Hi Michelle,\n\nI had another look and the narrower opportunity appears stronger around the return journey.',
  }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('mandatory_opt_out_missing'));
});

test('initial, value follow-up and close-loop all require the exact literal', () => {
  for (const [touchType, touchNo] of [['initial', 1], ['value_follow_up', 2], ['close_loop', 3]]) {
    const pass = validateOutbound(prospectPayload({
      touchType,
      touchNo,
      idempotencyKey: `REGRESSION-LEAD|${touchNo}`,
      sequenceApproved: touchNo > 1,
    }));
    assert.equal(pass.ok, true, `${touchType} should pass with exact literal`);

    const fail = validateOutbound(prospectPayload({
      touchType,
      touchNo,
      idempotencyKey: `REGRESSION-FAIL|${touchNo}`,
      sequenceApproved: touchNo > 1,
      text: "Useful factual message.\n\nIf you'd rather I didn't follow up just let me know.",
    }));
    assert.equal(fail.ok, false, `${touchType} near-miss wording must fail`);
    assert.ok(fail.errors.includes('mandatory_opt_out_missing'));
  }
});
