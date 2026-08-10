'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateNotionQualityGate,
  extractNotionPageId,
} = require('../scripts/linkedin-notion-quality-gate.cjs');

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
      ...overrides,
    },
  };
}

test('extracts Notion page IDs from queue source URLs', () => {
  assert.equal(
    extractNotionPageId('https://app.notion.com/3ace72eb85878183a413d264211cab80'),
    '3ace72eb85878183a413d264211cab80',
  );
});

test('passes only a fully cleared live Notion row', () => {
  const result = evaluateNotionQualityGate(page(), '3ace72eb85878183a413d264211cab80');
  assert.equal(result.pass, true);
  assert.deepEqual(result.reasons, []);
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

test('fails closed on non-approved or blocked automation state', () => {
  const result = evaluateNotionQualityGate(page({
    Approval: { select: { name: 'Changes Needed' } },
    'Automation Status': { select: { name: 'Blocked' } },
  }));
  assert.equal(result.pass, false);
  assert.equal(result.reasons.length, 2);
});
