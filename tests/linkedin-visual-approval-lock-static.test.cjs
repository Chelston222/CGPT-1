'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('retired Retention School renderer cannot regenerate media', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/retention-school-launch-render.yml'), 'utf8');
  assert.match(workflow, /render retired/i);
  assert.doesNotMatch(workflow, /rsvg-convert/);
  assert.match(workflow, /exact owner-approved asset/i);
});
