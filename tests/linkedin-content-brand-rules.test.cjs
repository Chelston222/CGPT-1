'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const reviewDir = path.join(root, 'apps', 'linkedin-review');
const jsonFiles = fs.readdirSync(reviewDir).filter((name) => /^(queue|qa-replenishment).*\.json$/.test(name));
const forbiddenOrigin = /this is why i (?:made|built|started|created) 222 emails/i;

test('operational content avoids deprecated 222 Emails founder-origin phrasing', () => {
  for (const name of jsonFiles) {
    const text = fs.readFileSync(path.join(reviewDir, name), 'utf8');
    assert.doesNotMatch(text, forbiddenOrigin, name);
  }
});

test('content rules lock Triple Two Emails as the public brand name', () => {
  const rules = fs.readFileSync(path.join(root, 'docs', 'LINKEDIN_CONTENT_RULES.md'), 'utf8');
  assert.match(rules, /Public-facing brand name: \*\*Triple Two Emails\*\*/);
  assert.match(rules, /native LinkedIn Page mention/i);
  assert.match(rules, /Never fake a native mention/i);
});
