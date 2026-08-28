'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const workflow = fs.readFileSync('.github/workflows/linkedin-content-os-green-gate.yml', 'utf8');

test('publication backlog only counts current post-hardening acceptances', () => {
  assert.match(workflow, /const isCurrent = Number\.isFinite\(row\.acceptedAt\) && row\.acceptedAt >= HARDENING_CUTOFF;/);
  assert.match(workflow, /if \(isCurrent && Number\.isFinite\(due\) && now - due >= 30 \* 60 \* 1000 && !terminal\) publicationBacklog \+= 1;/);
});

test('historical debt remains visible without poisoning current green state', () => {
  assert.match(workflow, /Preserved pre-hardening native analytics debt/);
  assert.match(workflow, /Historical analytics debt stays visible and is never rewritten as captured/);
});

test('green requires provider recurring configuration, timezone and connection health', () => {
  assert.match(workflow, /channel\(input: \{ id:/);
  assert.match(workflow, /postingSchedule \{ day paused times \}/);
  assert.match(workflow, /channel\.timezone === 'Europe\/London'/);
  assert.match(workflow, /!channel\.isDisconnected && !channel\.isLocked && !channel\.isQueuePaused/);
  assert.match(workflow, /const green = providerConfigHealthy && fixedTimeQueue && queueHealthy/);
});

test('green requires a fixed-time queue fingerprint before recurring settings change', () => {
  assert.match(workflow, /isCustomScheduled shareMode/);
  assert.match(workflow, /slotDrivenPosts/);
  assert.match(workflow, /createHash\('sha256'\)/);
  assert.match(workflow, /Scheduled queue fixed-time and immune to recurring-slot movement/);
});

test('personal recurring schedule is one guaranteed core slot per day, not two automatic slots', () => {
  assert.match(workflow, /personal: \{ maxWeek: 7, maxPerDay: 1, requireEveryDay: true \}/);
  assert.match(workflow, /everyDayPass/);
});

test('company and secondary recurring schedules are capped at five per week', () => {
  assert.match(workflow, /main: \{ maxWeek: 5, maxPerDay: 1, requireEveryDay: false \}/);
  assert.match(workflow, /secondary: \{ maxWeek: 5, maxPerDay: 1, requireEveryDay: false \}/);
});

test('secondary identity must resolve to Retention School before full green', () => {
  assert.match(workflow, /target !== 'secondary' \|\| \/retention school\/i/);
});
