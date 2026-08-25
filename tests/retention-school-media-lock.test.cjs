'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const lock = fs.readFileSync('docs/RETENTION_SCHOOL_MEDIA_RELEASE_LOCK.md', 'utf8');

test('Retention School release lock forbids substituted creatives', () => {
  assert.match(lock, /No SVG redraw, recreation, substitution, enhancement, reinterpretation or generated stand-in/i);
  assert.match(lock, /byte count and SHA-256 fingerprint/i);
  assert.match(lock, /fail closed/i);
  assert.match(lock, /If the exact approved binary is unavailable, do not guess/i);
});
