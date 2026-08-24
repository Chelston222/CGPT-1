'use strict';

const assert = require('node:assert/strict');
const {
  REQUIRED_OPT_OUT,
  validateProspectCopyPreflight,
  assertProspectCopyPreflight,
} = require('../scripts/tte-prospect-copy-preflight.cjs');

const regressions = [
  {
    name: '24 Aug Jake Alexander failure shape',
    input: {
      leadId: 'CALL-20260821-001',
      touchNo: 1,
      touchType: 'initial',
      body: 'Hi Jake,\n\nI was looking at Jake Alexander because hair, extensions, aesthetics, gift cards and the academy all sit under one operation.\n\nWould it be useful if I showed you the narrow client-return gap I noticed?',
    },
  },
  {
    name: '24 Aug Cosmetic Aesthetics failure shape',
    input: {
      leadId: 'RRO-COSMETIC-AESTHETICS',
      touchNo: 2,
      touchType: 'value_follow_up',
      body: 'Hi Michelle,\n\nI had another look after my earlier note and the narrower opportunity appears stronger around course-interest and treatment-cycle follow-up.\n\nWorth me sending the exact observation?',
    },
  },
];

for (const testCase of regressions) {
  const result = validateProspectCopyPreflight(testCase.input);
  assert.equal(result.ok, false, testCase.name);
  assert.equal(result.code, 'OPT_OUT_ABSENT', testCase.name);
  assert.throws(
    () => assertProspectCopyPreflight(testCase.input),
    (error) => error && error.code === 'OPT_OUT_ABSENT',
    testCase.name,
  );
}

for (const touchType of ['initial', 'value_follow_up', 'close_loop']) {
  const result = assertProspectCopyPreflight({
    leadId: 'TEST-LEAD',
    touchNo: 1,
    touchType,
    body: `Useful, factual prospect message.\n\n${REQUIRED_OPT_OUT}`,
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'COPY_PREFLIGHT_PASS');
}

const nearMiss = validateProspectCopyPreflight({
  leadId: 'TEST-NEAR-MISS',
  touchNo: 1,
  touchType: 'initial',
  body: "If you'd rather I didn't follow up just let me know.",
});
assert.equal(nearMiss.ok, false, 'Near-miss wording must not satisfy the literal gate');

const nonProspect = validateProspectCopyPreflight({
  touchType: 'transactional',
  body: 'Internal verification message',
});
assert.equal(nonProspect.ok, true);
assert.equal(nonProspect.enforced, false);

console.log('tte-prospect-copy-preflight: PASS');
