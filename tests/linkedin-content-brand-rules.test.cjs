'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { buildCreatePostMutation, tripleTwoPageAnnotations } = require('../scripts/linkedin-review-core.cjs');

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

test('personal copy mentioning Triple Two Emails becomes a native LinkedIn Page annotation', () => {
  const channel = {
    target: 'personal',
    id: 'personal-buffer-channel',
    text: 'I built this system with Triple Two Emails to make follow-up more reliable.',
    dueAt: '2026-08-20T08:15:00.000Z',
  };
  const annotations = tripleTwoPageAnnotations(channel);
  assert.equal(annotations.length, 1);
  assert.equal(annotations[0].id, '105869150');
  assert.equal(annotations[0].entity, 'urn:li:organization:105869150');
  assert.equal(channel.text.slice(annotations[0].start, annotations[0].start + annotations[0].length), 'Triple Two Emails');
  const mutation = buildCreatePostMutation(channel, 'schedule');
  assert.match(mutation, /metadata: \{ linkedin: \{ annotations:/);
  assert.match(mutation, /urn:li:organization:105869150/);
});

test('main Triple Two Emails Page does not self-tag', () => {
  const channel = {
    target: 'main',
    id: 'main-buffer-channel',
    text: 'Triple Two Emails builds client return systems.',
    dueAt: '2026-08-20T08:30:00.000Z',
  };
  assert.deepEqual(tripleTwoPageAnnotations(channel), []);
  assert.doesNotMatch(buildCreatePostMutation(channel, 'schedule'), /annotations:/);
});
