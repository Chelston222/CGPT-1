'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { inferTraits } = require('../scripts/linkedin-content-traits-v2.cjs');

test('separates acquisition contrast from generic acquisition framing', () => {
  const contrast = inferTraits('Before buying more leads, I would ask what happened to the people who already showed interest.');
  const generic = inferTraits('Lead generation and acquisition are important growth channels for businesses.');
  assert.ok(contrast.includes('acquisition_contrast'));
  assert.ok(!contrast.includes('acquisition_frame'));
  assert.ok(generic.includes('acquisition_frame'));
  assert.ok(!generic.includes('acquisition_contrast'));
  assert.ok(!contrast.includes('more_leads_frame'));
});

test('detects human behaviour that explains founder and customer return stories', () => {
  const traits = inferTraits('I forgot to reply because the day got busy. Clients mean to come back too, then life gets in the way and memory becomes the system.');
  assert.ok(traits.includes('human_behaviour'));
});

test('detects proof discipline rather than treating all proof language equally', () => {
  const disciplined = inferTraits('Before showing proof, show the problem that existed. A campaign result does not automatically prove recovered appointment revenue.');
  const generic = inferTraits('Here is proof from a campaign result.');
  assert.ok(disciplined.includes('proof_discipline'));
  assert.ok(generic.includes('proof_or_evidence'));
});

test('detects ownership, state classification, stop logic and timing', () => {
  const traits = inferTraits('Who owns the outcome? A cancelled client is now in a different customer state. Stop the reminder once they book, and time the next message around the normal return window.');
  assert.ok(traits.includes('operational_ownership'));
  assert.ok(traits.includes('state_classification'));
  assert.ok(traits.includes('stop_logic'));
  assert.ok(traits.includes('timing_logic'));
});
