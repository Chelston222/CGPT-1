'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bridge = require('../scripts/linkedin-notion-reserve-bridge.cjs');

const NOW = Date.parse('2026-09-15T06:00:00Z');
const HASH = 'a'.repeat(64);

function rich(value) { return { rich_text: [{ plain_text: value, text: { content: value } }] }; }
function title(value) { return { title: [{ plain_text: value, text: { content: value } }] }; }
function select(value) { return { select: { name: value } }; }
function row(overrides = {}) {
  return {
    object: 'page',
    id: '3dbe72eb-8587-81e1-8d17-d7a1725ba008',
    archived: false,
    in_trash: false,
    properties: {
      Post: title('A happy client is not the same as a rebooked client.'),
      'Post ID': { unique_id: { number: 133 } },
      'Content Decision': select('Keep'),
      Approval: select('Approved'),
      'Publication State': select('Approved for Publish'),
      'Asset Ready': { checkbox: true },
      'Automation Ready': { checkbox: true },
      'Automation Status': select('Ready to Sync'),
      'Anti-DNA | Pass': { checkbox: true },
      'Public Trust Boundary Pass': { checkbox: true },
      'Story Gate': select('Not Applicable'),
      'Buffer Status': select('Ready for Buffer'),
      'Publication Route': select('Buffer'),
      'Reserve Enabled': { checkbox: true },
      'Manual Review Required': { checkbox: false },
      'Source Needed': { checkbox: false },
      'External Post ID': rich(''),
      'Post URL': { url: null },
      'Sync Error': rich(''),
      'Final Copy': rich('A happy client can still leave without another appointment.'),
      'Publish Payload': rich('A happy client can still leave without another appointment.'),
      'Alt Text': rich('Standalone 222Emails client return poster.'),
      'Media URL': { url: 'https://raw.githubusercontent.com/Chelston222/CGPT-1/main/assets/linkedin-generated/reserve-01.png' },
      Platform: select('LinkedIn Personal'),
      'Posting Identity': rich('Chelston personal (personal)'),
      Version: rich('Visual Reserve Imagegen Final 1'),
      'Scheduled At': { date: { start: '2026-09-18T08:15:00+01:00' } },
      'Visual Review Due': { date: { start: '2026-10-15T00:00:00+01:00' } },
      'Reserve Order': { number: 1 },
      Pillar: select('Repeat Bookings'),
      Funnel: select('TOF'),
      ...overrides.properties,
    },
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'properties')),
  };
}

function media(overrides = {}) { return { bytes: 1014086, sha256: HASH, ...overrides }; }

test('happy path builds review-only candidate with exact authority boundaries', () => {
  const post = bridge.buildCandidate(row(), media(), NOW);
  assert.equal(post.id, 'tte-reserve-133');
  assert.equal(post.revision, 1);
  assert.equal(post.sourceType, 'notion_reserve');
  assert.equal(post.status, 'review');
  assert.equal(post.qa.status, 'ready_for_human_review');
  assert.equal(post.qa.approvalEligible, true);
  assert.equal(post.qa.publishPermission, false);
  assert.deepEqual(post.targets, ['personal']);
  assert.equal(post.mediaSha256, HASH);
});

test('Notion approval is required for staging', () => {
  const result = bridge.evaluateReserveEligibility(row({ properties: { Approval: select('Needs Review') } }), NOW);
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /Approval/);
});

test('revoked approval fails closed', () => {
  const result = bridge.evaluateReserveEligibility(row({ properties: { Approval: select('Changes Needed') } }), NOW);
  assert.equal(result.pass, false);
});

test('private Google Drive share is not accepted as delivery media', () => {
  const result = bridge.evaluateReserveEligibility(row({ properties: { 'Media URL': { url: 'https://drive.google.com/file/d/test/view' } } }), NOW);
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /stable direct public file URL/);
});

test('posting identity and platform must agree', () => {
  const result = bridge.evaluateReserveEligibility(row({ properties: { Platform: select('LinkedIn Company') } }), NOW);
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /mismatched posting identity/);
});

test('caption and publish payload must match exactly', () => {
  const result = bridge.evaluateReserveEligibility(row({ properties: { 'Publish Payload': rich('Changed') } }), NOW);
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /exactly match/);
});

test('expired visual review blocks staging', () => {
  const result = bridge.evaluateReserveEligibility(row({ properties: { 'Visual Review Due': { date: { start: '2026-09-14T00:00:00Z' } } } }), NOW);
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /expired/);
});

test('scheduled time must remain safely in the future', () => {
  const result = bridge.evaluateReserveEligibility(row({ properties: { 'Scheduled At': { date: { start: '2026-09-15T06:03:00Z' } } } }), NOW);
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /five minutes/);
});

test('external post evidence blocks a second staging path', () => {
  const result = bridge.evaluateReserveEligibility(row({ properties: { 'External Post ID': rich('buffer-already-exists') } }), NOW);
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /External Post ID/);
});

test('manual-review and source blockers fail closed', () => {
  const result = bridge.evaluateReserveEligibility(row({ properties: {
    'Manual Review Required': { checkbox: true },
    'Source Needed': { checkbox: true },
  } }), NOW);
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /Manual Review/);
  assert.match(result.reasons.join(' '), /Source Needed/);
});

test('identical replay is idempotent and creates no duplicate', () => {
  const post = bridge.buildCandidate(row(), media(), NOW);
  const first = bridge.mergeCandidate({ schemaVersion: 1, posts: [] }, post);
  const replay = bridge.mergeCandidate(first.payload, post);
  assert.equal(first.changed, true);
  assert.equal(replay.changed, false);
  assert.equal(replay.reason, 'idempotent_replay');
  assert.equal(replay.payload.posts.length, 1);
});

test('changed payload at same revision is rejected as drift', () => {
  const first = bridge.buildCandidate(row(), media(), NOW);
  const changed = { ...first, copy: { default: 'Changed after lock' } };
  assert.throws(() => bridge.mergeCandidate({ schemaVersion: 1, posts: [first] }, changed), /drifted after staging/);
});

test('revision must advance to replace staged content', () => {
  const first = bridge.buildCandidate(row(), media(), NOW);
  const next = bridge.buildCandidate(row({ properties: { Version: rich('Visual Reserve Imagegen Final 2') } }), media(), NOW);
  const result = bridge.mergeCandidate({ schemaVersion: 1, posts: [first] }, next);
  assert.equal(result.changed, true);
  assert.equal(result.reason, 'revision_advanced');
  assert.equal(result.payload.posts[0].revision, 2);
});

test('bad media proof never enters the queue', () => {
  assert.throws(() => bridge.buildCandidate(row(), { bytes: 0, sha256: 'bad' }, NOW), /Media byte count/);
});

test('secondary identity is supported only on the company platform', () => {
  const secondary = row({ properties: {
    Platform: select('LinkedIn Company'),
    'Posting Identity': rich('222Emails | Retention School (secondary)'),
  } });
  const result = bridge.evaluateReserveEligibility(secondary, NOW);
  assert.equal(result.pass, true);
  assert.equal(result.snapshot.target, 'secondary');
});

test('public trust and story gates fail closed before staging', () => {
  const noTrust = bridge.evaluateReserveEligibility(row({ properties: { 'Public Trust Boundary Pass': { checkbox: false } } }), NOW);
  assert.equal(noTrust.pass, false);
  assert.match(noTrust.reasons.join(' '), /Public Trust Boundary/);

  const badStory = bridge.evaluateReserveEligibility(row({ properties: { 'Story Gate': select('Needs Review') } }), NOW);
  assert.equal(badStory.pass, false);
  assert.match(badStory.reasons.join(' '), /Story Gate/);

  const passStory = bridge.evaluateReserveEligibility(row({ properties: { 'Story Gate': select('Pass') } }), NOW);
  assert.equal(passStory.pass, true);
});
