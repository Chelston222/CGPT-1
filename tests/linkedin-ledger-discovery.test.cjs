'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { selectTrustedLedgerIssue, LEDGER_TITLE } = require('../scripts/linkedin-buffer-acceptance-ledger.cjs');
const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/linkedin-buffer-autopost.yml'), 'utf8');
const definition = workflow.match(/            async function requireExistingLedgerIssue\(\) \{[\s\S]*?\n            \}/)?.[0];
assert.ok(definition, 'exercise the deployed workflow ledger discovery function');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function discover(issues, failure = null) {
  const calls = [];
  const github = {
    rest: { issues: {
      listForRepo: 'list-issues',
      create: async input => { calls.push({ action: 'create', input }); return { data: { number: 999 } }; },
      update: async input => { calls.push({ action: 'update', input }); return { data: input }; },
    } },
    paginate: async (endpoint, options) => {
      calls.push({ action: 'read', endpoint, options });
      if (failure) throw failure;
      return issues;
    },
  };
  const execute = new AsyncFunction('github', 'selectTrustedLedgerIssue', 'owner', 'repo', `${definition}\nreturn requireExistingLedgerIssue();`);
  let number; let error;
  try { number = await execute(github, selectTrustedLedgerIssue, 'Chelston222', 'CGPT-1'); }
  catch (caught) { error = caught; }
  assert.deepEqual(calls.map(call => call.action), ['read'], 'ledger discovery must never create or reopen an issue');
  assert.equal(calls[0].options.state, 'all', 'closed ledgers retain idempotency authority');
  return { number, error };
}

const ledger = { number: 677, title: LEDGER_TITLE, state: 'open', user: { login: 'github-actions[bot]' } };

test('missing ledger fails closed instead of creating an empty second history', async () => {
  const result = await discover([]);
  assert.match(result.error?.message || '', /Automatic ledger creation is disabled/);
  assert.equal(result.number, undefined);
});

test('existing trusted ledger remains the dispatch history', async () => {
  const result = await discover([ledger]);
  assert.equal(result.number, 677);
  assert.equal(result.error, undefined);
});

test('closed trusted ledger is preserved without implicit reopening', async () => {
  const result = await discover([{ ...ledger, state: 'closed' }]);
  assert.equal(result.number, 677);
});

test('duplicate trusted ledgers still block publishing', async () => {
  const result = await discover([ledger, { ...ledger, number: 822 }]);
  assert.match(result.error?.message || '', /split-brain/);
  assert.equal(result.number, undefined);
});

test('untrusted issue cannot bootstrap publisher idempotency state', async () => {
  const result = await discover([{ ...ledger, user: { login: 'outside-user' } }]);
  assert.match(result.error?.message || '', /Automatic ledger creation is disabled/);
});

test('failed pagination does not create or select a fallback ledger', async () => {
  const failure = new Error('GitHub page two unavailable');
  const result = await discover([ledger], failure);
  assert.equal(result.error, failure);
  assert.equal(result.number, undefined);
});
