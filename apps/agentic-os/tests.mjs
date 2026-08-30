import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateState, loadConfig } from './engine.mjs';
import { freeWindows, planCalendar, renderIcs } from './calendar.mjs';

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

console.log(`Agentic OS acceptance suite PASS: ${evaluated.tasks.length} fixture tasks, ${plan.blocks.length} calendar blocks, DST-safe, stable IDs, terminal-canonical guard, dependency guard, bounded 21-day simulation.`);
