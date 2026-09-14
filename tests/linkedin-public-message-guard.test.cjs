'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertCurrentPublicMessageGuard,
  evaluateCurrentPublicMessageGuard,
} = require('../scripts/linkedin-public-message-guard.cjs');
const { validateRequest } = require('../scripts/linkedin-review-core.cjs');

const ENV = {
  BUFFER_API_KEY: 'test',
  BUFFER_LINKEDIN_PERSONAL_CHANNEL_ID: 'personal-test',
  BUFFER_LINKEDIN_BUSINESS_CHANNEL_ID: 'main-test',
  BUFFER_LINKEDIN_SECONDARY_CHANNEL_ID: 'secondary-test',
};

function post(copy, extra = {}) {
  return {
    id: 'tte-test',
    revision: 1,
    title: 'Current public copy',
    copy: { default: copy },
    ...extra,
  };
}

function approvedBody(copy, extraHeader = '') {
  return [
    'POST_ID: tte-test',
    'REVISION: 1',
    'TARGETS: personal',
    'MODE: draft',
    'CONTENT_QA: PASS',
    extraHeader,
    '---',
    copy,
  ].filter(Boolean).join('\n');
}

test('current Revenue Recovery Check language passes', () => {
  const result = assertCurrentPublicMessageGuard(post(
    'Start with the Free Revenue Recovery Check. It takes about three minutes to begin and no mandatory discovery call is required.'
  ));
  assert.equal(result.pass, true);
});

test('retired Client Return Fit Check naming fails closed', () => {
  const result = evaluateCurrentPublicMessageGuard(post('Start with the Client Return Fit Check.'));
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' | '), /Fit Check/);
});

test('keyword-gated access fails closed', () => {
  const result = evaluateCurrentPublicMessageGuard(post('Comment FIT and I will send you the Recovery Check.'));
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' | '), /Keyword-gated/);
});

test('required call framing for the current free diagnostic fails closed', () => {
  const result = evaluateCurrentPublicMessageGuard(post('The Free Revenue Recovery Check requires a short call before we can begin.'));
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' | '), /requiring a call or conversation/);
});

test('Retention Lab as a current public brand fails closed', () => {
  const result = evaluateCurrentPublicMessageGuard(post('New from 222Emails | Retention Lab: a lifecycle teardown.'));
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' | '), /Retention Lab/);
});

test('spaced company name fails closed', () => {
  const result = evaluateCurrentPublicMessageGuard(post('222 Emails helps appointment-led businesses improve rebooking.'));
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' | '), /222Emails/);
});

test('historical audit records are exempt and remain readable', () => {
  const result = evaluateCurrentPublicMessageGuard(
    post('I want to be clear about what a Fit Check is. It is a short conversation.'),
    { phase: 'history' },
  );
  assert.equal(result.pass, true);
  assert.deepEqual(result.reasons, []);
});

test('central validateRequest accepts current Revenue Recovery Check copy', () => {
  const request = validateRequest(
    approvedBody('Start with the Free Revenue Recovery Check. No mandatory discovery call is required.'),
    ENV,
  );
  assert.equal(request.postId, 'tte-test');
  assert.equal(request.channels[0].text.includes('Revenue Recovery Check'), true);
});

test('central validateRequest rejects retired current-facing copy before Buffer', () => {
  assert.throws(
    () => validateRequest(approvedBody('DM FIT and I will send the Client Return Fit Check.'), ENV),
    /current public message guard/i,
  );
});

test('central validateRequest checks target-specific copy variants', () => {
  const body = [
    'POST_ID: tte-test',
    'REVISION: 1',
    'TARGETS: personal,main',
    'MODE: draft',
    'CONTENT_QA: PASS',
    '---',
    'Current default copy.',
    '---PERSONAL---',
    'Current personal copy.',
    '---MAIN---',
    'New from 222Emails | Retention Lab.',
  ].join('\n');
  assert.throws(() => validateRequest(body, ENV), /Retention Lab/);
});
