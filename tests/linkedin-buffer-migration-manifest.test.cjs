'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/buffer-migration-2026-08-23.json'), 'utf8'));
const policy = JSON.parse(fs.readFileSync(path.join(root, 'apps/linkedin-review/distribution-policy.json'), 'utf8'));

const decisions = new Set(['KEEP', 'MOVE', 'REPURPOSE', 'RETIRE']);
assert.equal(manifest.status, 'classified_not_applied', 'Classification manifest must not imply Buffer writes occurred.');
assert.equal(manifest.sourceSnapshotIssue, 381);
assert.equal(manifest.governingIssue, 331);
assert.equal(manifest.placements.length, 26, 'The pre-migration live snapshot contains 26 placements.');

const keys = new Set();
for (const row of manifest.placements) {
  const key = `${row.id}@${row.revision}:${row.target}`;
  assert(!keys.has(key), `Duplicate migration placement: ${key}`);
  keys.add(key);
  assert(decisions.has(row.decision), `${key} has invalid decision ${row.decision}`);
  assert(row.reason && row.reason.trim().length >= 20, `${key} needs an evidence-based migration reason.`);
  assert(Number.isInteger(row.approvalIssue) && row.approvalIssue > 0, `${key} needs its owner-approval issue.`);
  assert(row.dueAt, `${key} needs its original approved due time.`);
  if (row.decision === 'MOVE') {
    assert(row.proposedDueAt, `${key} MOVE requires a proposed due time.`);
    assert.notEqual(row.proposedDueAt, row.dueAt, `${key} MOVE cannot keep the same due time.`);
  }
  if (row.decision === 'REPURPOSE') assert(row.repurposeRoute, `${key} REPURPOSE requires a route.`);
}

function localDate(value, timeZone = 'Europe/London') {
  const date = new Date(value);
  assert(!Number.isNaN(date.getTime()), `Invalid date ${value}`);
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function weekKey(local) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(local);
  assert(match, `Invalid local date ${local}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const feedRows = manifest.placements.filter((row) => row.decision === 'KEEP' || row.decision === 'MOVE');
const daily = new Map();
const weekly = new Map();
for (const row of feedRows) {
  const when = row.decision === 'MOVE' ? row.proposedDueAt : row.dueAt;
  const date = localDate(when, manifest.timezone || policy.timezone || 'Europe/London');
  const week = weekKey(date);
  const dkey = `${date}:${row.target}`;
  const wkey = `${week}:${row.target}`;
  daily.set(dkey, (daily.get(dkey) || 0) + 1);
  weekly.set(wkey, (weekly.get(wkey) || 0) + 1);
}

for (const [key, count] of daily) {
  const target = key.split(':').at(-1);
  const max = Number(policy.accounts?.[target]?.maximumPerDay);
  assert(Number.isFinite(max), `No daily cadence policy for ${target}`);
  assert(count <= max, `${key} has ${count} planned placements > ${max}/day.`);
}
for (const [key, count] of weekly) {
  const target = key.split(':').at(-1);
  const max = Number(policy.accounts?.[target]?.maximumPerWeek);
  assert(Number.isFinite(max), `No weekly cadence policy for ${target}`);
  assert(count <= max, `${key} has ${count} planned placements > ${max}/week.`);
}

const personal = manifest.placements.filter((row) => row.target === 'personal');
assert.equal(personal.length, 8);
assert(personal.every((row) => row.decision === 'KEEP'), 'Current personal queue is already one-per-day and should remain intact in this migration.');

const week35Main = feedRows.filter((row) => row.target === 'main' && weekKey(localDate(row.decision === 'MOVE' ? row.proposedDueAt : row.dueAt)) === '2026-W35');
const week35Secondary = feedRows.filter((row) => row.target === 'secondary' && weekKey(localDate(row.decision === 'MOVE' ? row.proposedDueAt : row.dueAt)) === '2026-W35');
assert.equal(week35Main.length, 5, 'Week 35 company feed must resolve to five placements.');
assert.equal(week35Secondary.length, 5, 'Week 35 Retention School feed must resolve to five placements.');

assert.equal(manifest.placements.filter((row) => row.decision === 'RETIRE').length, 0, 'This migration preserves useful inventory; no live RR14 placement is destroyed.');
console.log('PASS linkedin-buffer-migration-manifest');
