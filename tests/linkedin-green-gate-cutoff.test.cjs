'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const workflow = fs.readFileSync('.github/workflows/linkedin-content-os-green-gate.yml', 'utf8');

test('publication backlog only counts current post-hardening acceptances', () => {
  assert.match(workflow, /const isCurrent = Number\.isFinite\(row\.acceptedAt\) && row\.acceptedAt >= HARDENING_CUTOFF;/);
  assert.match(workflow, /if \(isCurrent && Number\.isFinite\(due\) && now - due >= 30 \* 60 \* 1000 && !terminal\) publicationBacklog \+= 1;/);
});

test('historical debt remains visible without poisoning current green state', () => {
  assert.match(workflow, /Preserved pre-hardening native analytics debt/);
  assert.match(workflow, /does not permanently poison the current release contract/);
});
