import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateState, loadConfig } from './engine.mjs';
import { freeWindows, planCalendar, renderIcs } from './calendar.mjs';
import { parseOwnership, reconcileCalendar, renderOwnedEventsIcs } from './reconcile.mjs';

const config = loadConfig();
const state = JSON.parse(fs.readFileSync(new URL('./fixtures/simulation.json', import.meta.url), 'utf8'));
const evaluated = evaluateState(state, config);
const plan = planCalendar(state, evaluated, config);

const byId = id => evaluated.tasks.find(t => t.id === id);
assert.equal(byId('old-sales-route').status, 'MERGED');
assert.equal(byId('old-sales-route').supersededBy, 'new-sales-route');
assert.equal(byId('completed-child').status, 'OBSOLETE');
assert.equal(byId('expired-task').status, 'KILL');
assert.equal(byId('stale-recurring').status, 'DEFER');
assert.equal(byId('blocked-task').status, 'BLOCKED');
assert.equal(byId('missed-stale').status, 'DEFER');
assert.equal(evaluated.ranked[0].id, 'new-sales-route');
assert.equal(evaluated.health.green, true);

const ids = plan.blocks.map(b => b.aosId);
assert.equal(new Set(ids).size, ids.length, 'calendar block IDs must be unique');
assert(plan.capacity.protectedSlackMinutes > 0, 'normal mode must preserve slack');
assert(plan.capacity.utilisationOfFreePercent <= 80.01, 'scheduled work must not consume protected slack');

for (const b of plan.blocks) {
  for (const h of state.hardCommitments) {
    const overlap = new Date(b.start) < new Date(h.end) && new Date(h.start) < new Date(b.end);
    assert.equal(overlap, false, `AOS block ${b.aosId} must not collide with hard commitment ${h.id}`);
  }
}

const plan2 = planCalendar(state, evaluated, config);
assert.deepEqual(plan2.blocks, plan.blocks, 'planning must be deterministic/idempotent for identical state');

const ics = renderIcs(plan, config, new Date('2026-08-30T08:00:00Z'));
assert(ics.includes('X-WR-CALNAME:AOS • EXECUTION'));
assert(ics.includes('X-AOS-ID:'));
assert(ics.includes('X-AOS-ACTION-ID:'));
assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, plan.blocks.length);

// BST/GMT wall-clock safety: configured 07:20 must mean 07:20 Europe/London, not 07:20 UTC.
const summerWindows = freeWindows({ now: '2026-08-30T05:00:00Z', hardCommitments: [] }, config);
assert.equal(summerWindows[0].start.toISOString(), '2026-08-30T06:20:00.000Z', 'BST 07:20 must equal 06:20Z');
const winterWindows = freeWindows({ now: '2026-12-01T05:00:00Z', hardCommitments: [] }, config);
assert.equal(winterWindows[0].start.toISOString(), '2026-12-01T07:20:00.000Z', 'GMT 07:20 must equal 07:20Z');

// Stable ownership IDs must survive movement so reconciliation updates rather than duplicates.
const movableTask = {
  id: 'stable-action', title: 'Stable action', desiredOutcome: 'stable-outcome', createdAt: '2026-08-30T00:00:00Z',
  lastValidatedAt: '2026-08-30T00:00:00Z', durationMinutes: 30, strategicPriority: 90, expectedValue: 90,
  impactProbability: 90, urgency: 90, relevanceConfidence: 95, status: 'ACTIVE'
};
const movedStateA = { now: '2026-08-30T06:20:00Z', tasks: [movableTask], outcomes: [], hardCommitments: [] };
const movedEvalA = evaluateState(movedStateA, config);
const movedPlanA = planCalendar(movedStateA, movedEvalA, config);
const movedStateB = { ...movedStateA, hardCommitments: [{ id: 'manual', start: '2026-08-30T06:20:00Z', end: '2026-08-30T07:20:00Z' }] };
const movedEvalB = evaluateState(movedStateB, config);
const movedPlanB = planCalendar(movedStateB, movedEvalB, config);
assert.equal(movedPlanA.blocks[0].aosId, movedPlanB.blocks[0].aosId, 'same action must retain AOS block identity when moved');
assert.notEqual(movedPlanA.blocks[0].start, movedPlanB.blocks[0].start, 'movement test must actually move the block');
assert(movedPlanA.blocks[0].description.includes('AOS_OWNER=agentic-os'));
assert(movedPlanA.blocks[0].description.includes('AOS_ACTION_ID=stable-action'));

// A terminal task must never become the canonical merge target for fresh work.
const canonicalSafetyState = {
  now: '2026-08-30T08:00:00Z', outcomes: [], hardCommitments: [], tasks: [
    { id: 'dead-newer', familyId: 'family-x', desiredOutcome: 'x', createdAt: '2026-08-30T07:00:00Z', status: 'KILL', auditReason: 'already dead' },
    { id: 'live-older', familyId: 'family-x', desiredOutcome: 'x', createdAt: '2026-08-30T06:00:00Z', lastValidatedAt: '2026-08-30T06:00:00Z', durationMinutes: 30, status: 'ACTIVE' }
  ]
};
const canonicalSafety = evaluateState(canonicalSafetyState, config);
assert.equal(canonicalSafety.tasks.find(t => t.id === 'live-older').status, 'EXECUTE', 'live work must not merge into terminal work');

// Dependency whose outcome is already satisfied must not block downstream work.
const dependencyState = {
  now: '2026-08-30T08:00:00Z', hardCommitments: [], outcomes: [{ id: 'dep-outcome', satisfied: true }], tasks: [
    { id: 'dep', desiredOutcomeId: 'dep-outcome', desiredOutcome: 'Dependency outcome', status: 'ACTIVE', createdAt: '2026-08-29T08:00:00Z' },
    { id: 'child', desiredOutcome: 'Child outcome', dependencyIds: ['dep'], status: 'ACTIVE', createdAt: '2026-08-30T07:00:00Z', durationMinutes: 30 }
  ]
};
const dependencyEval = evaluateState(dependencyState, config);
assert.equal(dependencyEval.tasks.find(t => t.id === 'dep').status, 'OBSOLETE');
assert.equal(dependencyEval.tasks.find(t => t.id === 'child').status, 'EXECUTE');

// Live reconciliation contract: manual events are invisible to mutation, movement is UPDATE not CREATE,
// duplicate ownership fails closed, orphans outside the freeze window are removable, and near-term work is retained.
const desiredLiveBlock = {
  aosId: 'stable-block-1',
  actionId: 'live-action',
  taskId: 'live-action',
  title: 'AOS | LIVE ACTION',
  start: '2026-08-31T06:20:00.000Z',
  end: '2026-08-31T06:50:00.000Z',
  description: 'AOS_OWNER=agentic-os\nAOS_ACTION_ID=live-action\nAOS_BLOCK_ID=stable-block-1\nOutcome: live proof'
};
const manualEvent = {
  id: 'manual-1', summary: 'Founder Story + Photo Capture', start: '2026-08-31T07:00:00.000Z', end: '2026-08-31T07:15:00.000Z', description: 'manual'
};
const ownedExisting = {
  id: 'owned-1', summary: 'AOS | LIVE ACTION', start: '2026-08-31T06:30:00.000Z', end: '2026-08-31T07:00:00.000Z',
  description: 'AOS_OWNER=agentic-os\nAOS_ACTION_ID=live-action\nAOS_BLOCK_ID=stable-block-1\nOutcome: old timing'
};
const liveDiff = reconcileCalendar({ existingEvents: [manualEvent, ownedExisting], desiredBlocks: [desiredLiveBlock], now: '2026-08-30T07:25:00.000Z' });
assert.equal(liveDiff.creates.length, 0, 'movement of the same action must not create a duplicate');
assert.equal(liveDiff.updates.length, 1, 'movement of the same action must update the existing event');
assert.equal(liveDiff.updates[0].eventId, 'owned-1');
assert.equal(liveDiff.ignoredManualCount, 1, 'manual event must be ignored by reconciliation');
assert.equal(liveDiff.health.green, true);

const duplicateDiff = reconcileCalendar({ existingEvents: [ownedExisting, { ...ownedExisting, id: 'owned-2' }], desiredBlocks: [desiredLiveBlock], now: '2026-08-30T07:25:00.000Z' });
assert.equal(duplicateDiff.blockers[0].type, 'DUPLICATE_OWNED_EVENTS');
assert.equal(duplicateDiff.deletes.length, 0, 'duplicate ambiguity must fail closed rather than deleting one');
assert.equal(duplicateDiff.health.green, false);

const orphanFuture = {
  id: 'orphan-future', summary: 'AOS | OLD ACTION', start: '2026-08-31T12:00:00.000Z', end: '2026-08-31T12:30:00.000Z',
  description: 'AOS_OWNER=agentic-os\nAOS_ACTION_ID=old-action\nAOS_BLOCK_ID=old-block'
};
const orphanNear = {
  id: 'orphan-near', summary: 'AOS | NEAR ACTION', start: '2026-08-30T08:00:00.000Z', end: '2026-08-30T08:30:00.000Z',
  description: 'AOS_OWNER=agentic-os\nAOS_ACTION_ID=near-action\nAOS_BLOCK_ID=near-block'
};
const orphanDiff = reconcileCalendar({ existingEvents: [orphanFuture, orphanNear], desiredBlocks: [], now: '2026-08-30T07:25:00.000Z', freezeWindowMinutes: 120 });
assert.equal(orphanDiff.deletes.length, 1);
assert.equal(orphanDiff.deletes[0].eventId, 'orphan-future');
assert.equal(orphanDiff.retained.length, 1);
assert.equal(orphanDiff.retained[0].eventId, 'orphan-near');
assert.equal(parseOwnership(manualEvent).owned, false);
assert.equal(parseOwnership(ownedExisting).owned, true);

const liveIcs = renderOwnedEventsIcs([manualEvent, ownedExisting, orphanFuture], config, new Date('2026-08-30T07:25:00.000Z'));
assert.equal((liveIcs.match(/BEGIN:VEVENT/g) || []).length, 2, 'live fallback ICS must contain owned events only');
assert(!liveIcs.includes('Founder Story + Photo Capture'), 'manual events must never leak into AOS fallback ICS');
assert(liveIcs.includes('X-AOS-ACTION-ID:live-action'));

// Multi-cycle anti-backlog simulation: repeatedly miss flexible work while newer work supersedes it.
let rolling = structuredClone(state);
for (let day = 1; day <= 21; day++) {
  const now = new Date('2026-08-30T08:00:00Z');
  now.setUTCDate(now.getUTCDate() + day);
  rolling.now = now.toISOString();
  rolling.tasks.push({
    id: `daily-${day}`,
    title: `Daily candidate ${day}`,
    desiredOutcome: 'rolling-sales',
    familyId: 'rolling-sales',
    supersedesIds: day > 1 ? [`daily-${day - 1}`] : [],
    createdAt: rolling.now,
    lastValidatedAt: rolling.now,
    durationMinutes: 30,
    strategicPriority: 70 + Math.min(day, 20),
    expectedValue: 70,
    impactProbability: 70,
    urgency: 70,
    relevanceConfidence: 90,
    status: 'ACTIVE'
  });
  const cycle = evaluateState(rolling, config);
  rolling.tasks = cycle.tasks.map(t => ({ ...t, missed: t.status === 'EXECUTE' ? true : t.missed }));
  const live = rolling.tasks.filter(t => ['ACTIVE', 'OPEN', 'EXECUTE', 'SCHEDULE', 'BLOCKED', 'DEFER'].includes(t.status));
  assert(live.length < 12, `live backlog must remain bounded on day ${day}; got ${live.length}`);
}

console.log(`Agentic OS acceptance suite PASS: ${evaluated.tasks.length} fixture tasks, ${plan.blocks.length} calendar blocks, DST-safe, stable IDs, ownership-safe reconciliation, live ICS filtering, terminal-canonical guard, dependency guard, bounded 21-day simulation.`);
