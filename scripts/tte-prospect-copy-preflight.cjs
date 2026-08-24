'use strict';

const REQUIRED_OPT_OUT = "If you'd rather I didn't follow up, just let me know.";
const PROSPECT_TOUCH_TYPES = new Set(['initial', 'value_follow_up', 'close_loop']);

function normaliseTouchType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function validateProspectCopyPreflight(input = {}) {
  const touchType = normaliseTouchType(input.touchType);
  const body = typeof input.body === 'string' ? input.body : '';
  const leadId = String(input.leadId || '').trim();
  const touchNo = String(input.touchNo || '').trim();

  if (!PROSPECT_TOUCH_TYPES.has(touchType)) {
    return {
      ok: true,
      enforced: false,
      code: 'NOT_PROSPECT_COPY_TOUCH',
      leadId,
      touchNo,
      touchType,
    };
  }

  if (!body.includes(REQUIRED_OPT_OUT)) {
    return {
      ok: false,
      enforced: true,
      code: 'OPT_OUT_ABSENT',
      leadId,
      touchNo,
      touchType,
      requiredLiteral: REQUIRED_OPT_OUT,
    };
  }

  return {
    ok: true,
    enforced: true,
    code: 'COPY_PREFLIGHT_PASS',
    leadId,
    touchNo,
    touchType,
  };
}

function assertProspectCopyPreflight(input = {}) {
  const result = validateProspectCopyPreflight(input);
  if (!result.ok) {
    const error = new Error(`${result.code}: prospect copy blocked before provider submission`);
    error.code = result.code;
    error.preflight = result;
    throw error;
  }
  return result;
}

module.exports = {
  REQUIRED_OPT_OUT,
  PROSPECT_TOUCH_TYPES,
  validateProspectCopyPreflight,
  assertProspectCopyPreflight,
};
