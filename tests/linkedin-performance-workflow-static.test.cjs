'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const workflow = fs.readFileSync('.github/workflows/linkedin-performance-learning.yml', 'utf8');

test('performance learner is read-only towards Buffer and keeps explicit approval', () => {
  assert.match(workflow, /LINKEDIN LEARNING NOW/);
  assert.match(workflow, /performance-policy\.json/);
  assert.match(workflow, /extractCommercialSignals/);
  assert.match(workflow, /queueTargetPerChannel/);
  assert.match(workflow, /It does not publish, reschedule, or manufacture repository-owner approval/);
  assert.doesNotMatch(workflow, /createPost\s*\(/);
  assert.doesNotMatch(workflow, /mutation\s+CreatePost/i);
});

test('performance learner uses live capacity and diversity lanes', () => {
  assert.match(workflow, /status:\s*\[scheduled\]/);
  assert.match(workflow, /EXPLOIT/);
  assert.match(workflow, /ADJACENT/);
  assert.match(workflow, /EXPLORE/);
  assert.match(workflow, /minimumSamplesForSuppression/);
});
