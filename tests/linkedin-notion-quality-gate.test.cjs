'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateNotionQualityGate,
  extractNotionPageId,
} = require('../scripts/linkedin-notion-quality-gate.cjs');

function rich(value) {
  return { rich_text: [{ plain_text: value, text: { content: value } }] };
}

function page(overrides = {}) {
  return {
    object: 'page',
    id: '3ace72eb-8587-8183-a413-d264211cab80',
    properties: {
      'Content Decision': { select: { name: 'Keep' } },
      Approval: { select: { name: 'Approved' } },
      'Anti-DNA | Pass': { checkbox: true },
      'Automation Status': { select: { name: 'Ready to Sync' } },
      'Buffer Status': { select: { name: 'Ready for Buffer' } },
      'Asset Ready': { checkbox: true },
      'Automation Ready': { checkbox: true },
      'Final Copy': rich('Locked caption'),
      'Publish Payload': rich('Locked caption'),
      'Scheduled At': { date: { start: '2026-09-16T08:45:00+01:00' } },
      ...overrides,
    },
  };
}

function queuePost(overrides = {}) {
  return {
    id: 'rs-li-demo',
    revision: 1,
    sourceType: 'chatgpt_pdf_intake',
    sourceUrl: 'https://app.notion.com/3ace72eb85878183a413d264211cab80',
    targets: ['secondary'],
    scheduledAt: { secondary: '2026-09-16T07:45:00Z' },
    copy: { default: 'Locked caption' },
    ...overrides,
  };
}

test('extracts Notion page IDs from queue source URLs', () => {
  assert.equal(
    extractNotionPageId('https://app.notion.com/3ace72eb85878183a413d264211cab80'),
    '3ace72eb85878183a413d264211cab80',
  );
});

test('passes a fully cleared generic live Notion row', () => {
  const result = evaluateNotionQualityGate(page(), '3ace72eb85878183a413d264211cab80');
  assert.equal(result.pass, true);
  assert.deepEqual(result.reasons, []);
});

test('passes a PDF intake row only when live copy, readiness and schedule match the locked queue', () => {
  const result = evaluateNotionQualityGate(page(), '3ace72eb85878183a413d264211cab80', queuePost());
  assert.equal(result.pass, true);
  assert.equal(result.snapshot.finalCopyMatches, true);
  assert.equal(result.snapshot.publishPayloadMatches, true);
});

test('fails closed for refine, rebuild, repurpose or retire decisions', () => {
  for (const decision of ['Refine', 'Rebuild', 'Repurpose', 'Retire']) {
    const result = evaluateNotionQualityGate(page({ 'Content Decision': { select: { name: decision } } }));
    assert.equal(result.pass, false);
    assert.match(result.reasons.join(' '), /Content Decision/);
  }
});

test('fails closed when Anti-DNA has not passed', () => {
  const result = evaluateNotionQualityGate(page({ 'Anti-DNA | Pass': { checkbox: false } }));
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /Anti-DNA/);
});

test('fails closed on non-approved, blocked automation or non-release Buffer state', () => {
  const result = evaluateNotionQualityGate(page({
    Approval: { select: { name: 'Changes Needed' } },
    'Automation Status': { select: { name: 'Blocked' } },
    'Buffer Status': { select: { name: 'Manual Only' } },
  }));
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /Approval/);
  assert.match(result.reasons.join(' '), /Automation Status/);
  assert.match(result.reasons.join(' '), /Buffer Status/);
});

test('generic live rows may retain Manual automation state when another governed lane handles them', () => {
  const result = evaluateNotionQualityGate(page({ 'Automation Status': { select: { name: 'Manual' } } }), '3ace72eb85878183a413d264211cab80');
  assert.equal(result.pass, true);
});

test('governed PDF intake blocks Manual automation state before Buffer release', () => {
  const result = evaluateNotionQualityGate(page({ 'Automation Status': { select: { name: 'Manual' } } }), '3ace72eb85878183a413d264211cab80', queuePost());
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /Manual for governed PDF release/);
});

test('fails PDF intake if final copy or publish payload drifts after queue lock', () => {
  const result = evaluateNotionQualityGate(page({
    'Final Copy': rich('Changed caption'),
    'Publish Payload': rich('Changed caption'),
  }), '3ace72eb85878183a413d264211cab80', queuePost());
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /Final Copy/);
  assert.match(result.reasons.join(' '), /Publish Payload/);
});

test('fails PDF intake if asset or automation readiness is cleared', () => {
  const result = evaluateNotionQualityGate(page({
    'Asset Ready': { checkbox: false },
    'Automation Ready': { checkbox: false },
  }), '3ace72eb85878183a413d264211cab80', queuePost());
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /Asset Ready/);
  assert.match(result.reasons.join(' '), /Automation Ready/);
});

test('fails PDF intake if Notion schedule drifts from a single-target locked queue', () => {
  const result = evaluateNotionQualityGate(page({
    'Scheduled At': { date: { start: '2026-09-16T09:45:00+01:00' } },
  }), '3ace72eb85878183a413d264211cab80', queuePost());
  assert.equal(result.pass, false);
  assert.match(result.reasons.join(' '), /Scheduled At/);
});

test('accepts Queued in Buffer as a valid live state for retry checks after partial release', () => {
  const result = evaluateNotionQualityGate(page({
    'Automation Status': { select: { name: 'Synced' } },
    'Buffer Status': { select: { name: 'Queued in Buffer' } },
  }), '3ace72eb85878183a413d264211cab80', queuePost());
  assert.equal(result.pass, true);
});
