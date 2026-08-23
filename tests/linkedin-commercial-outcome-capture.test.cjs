'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const workflow = fs.readFileSync('.github/workflows/linkedin-commercial-outcome-capture.yml', 'utf8');

test('commercial outcome capture is owner-gated and publication-verified', () => {
  assert.match(workflow, /startsWith\(github\.event\.issue\.title, '\[LINKEDIN OUTCOME\]'\)/);
  assert.match(workflow, /github\.event\.issue\.user\.login == github\.repository_owner/);
  assert.match(workflow, /LINKEDIN_PUBLICATION_VERIFIED bufferId=/);
  assert.match(workflow, /github-actions\[bot\]/);
});

test('commercial outcome capture only allows bounded outcome taxonomy and unambiguous revenue counts', () => {
  for (const type of ['dm', 'reply', 'enquiry', 'fit_check', 'qualified', 'proposal', 'paid']) assert.match(workflow, new RegExp(`['\"]${type}['\"]`));
  assert.match(workflow, /COUNT must be an integer from 1 to 100/);
  assert.match(workflow, /COUNT must be 1 when VALUE_GBP is supplied/);
});

test('commercial outcome capture is retry-idempotent by capture issue', () => {
  assert.match(workflow, /LINKEDIN_OUTCOME_CAPTURE captureIssue=/);
  assert.match(workflow, /alreadyCaptured/);
  assert.match(workflow, /Retry treated as idempotent/);
  assert.match(workflow, /captureMarker/);
});

test('commercial outcome capture does not call Buffer or LinkedIn mutation APIs', () => {
  assert.doesNotMatch(workflow, /api\.buffer\.com/);
  assert.doesNotMatch(workflow, /linkedin\.com\/.*(?:post|share|update)/i);
});
