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

test('founder content rules reject generic AI-style founder stories', () => {
  const rules = fs.readFileSync(path.join(root, 'docs', 'LINKEDIN_CONTENT_RULES.md'), 'utf8');
  const strategy = fs.readFileSync(path.join(root, 'docs', 'LINKEDIN_CONTENT_STRATEGY_2026.md'), 'utf8');
  assert.match(rules, /Start from \*\*what actually happened\*\*/i);
  assert.match(rules, /Random-founder test/i);
  assert.match(rules, /Image-only test/i);
  assert.match(rules, /Status-performance test/i);
  assert.match(rules, /Saveable-story test/i);
  assert.match(rules, /£2\.5k weeks repeat consistently/i);
  assert.match(strategy, /Founder-story operating standard/i);
  assert.match(strategy, /could another founder post this/i);
  assert.match(strategy, /ask one precise question/i);
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


test('Story Worth Reading machine policy stays aligned with founder-content rules', () => {
  const policy = JSON.parse(fs.readFileSync(path.join(reviewDir, 'storytelling-policy.json'), 'utf8'));
  const standard = fs.readFileSync(path.join(root, 'docs', 'LINKEDIN_STORY_WORTH_READING_STANDARD.md'), 'utf8');
  assert.equal(policy.queue.automaticRefillTargetPerChannel, 8);
  assert.equal(policy.queue.bufferCeilingPerChannel, 10);
  assert.equal(policy.queue.reservedInstantSlotsPerChannel, 2);
  assert.equal(policy.missingFactRule, 'ask_one_precise_question_never_invent');
  assert.match(standard, /WHAT HAPPENED\?/);
  assert.match(standard, /current truth \+ specificity \+ tension \+ unfinished business/i);
  assert.match(standard, /Saveable-story test/i);
  assert.match(standard, /envy bait or success cosplay/i);
});


test('Narrative Architecture OS stays subordinate to source truth and Story Worth Reading', () => {
  const narrative = fs.readFileSync(path.join(root, 'docs', 'LINKEDIN_NARRATIVE_ARCHITECTURE_OS.md'), 'utf8');
  const policy = JSON.parse(fs.readFileSync(path.join(reviewDir, 'narrative-architecture-policy.json'), 'utf8'));
  const patterns = JSON.parse(fs.readFileSync(path.join(reviewDir, 'creator-pattern-bank.json'), 'utf8'));
  assert.match(narrative, /SOURCE TRUTH → STORY WORTH READING → CONTENT JOB → NARRATIVE ARCHITECTURE/i);
  assert.match(narrative, /Story → Lesson → Actionable Advice → You/i);
  assert.match(narrative, /question is not mandatory/i);
  assert.match(narrative, /research-method benchmark/i);
  assert.equal(policy.architectures.slay_overlay.questionRequired, false);
  assert.equal(policy.heuristics.laraMobileHookWords.hardGate, false);
  assert.equal(policy.externalResearch.kleoRole, 'research_method_benchmark_not_dependency');
  assert.equal(patterns.records.find((r) => r.id === 'lara-acosta-slay').evidenceConfidence, 'primary_public_source');
  assert.equal(patterns.records.find((r) => r.id === 'kleo-creator-research-method').evidenceConfidence, 'vendor_public_guidance');
});
