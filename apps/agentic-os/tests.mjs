import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateState, loadConfig } from './engine.mjs';
import { planCalendar, renderIcs } from './calendar.mjs';

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
assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, plan.blocks.length);

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

console.log(`Agentic OS acceptance suite PASS: ${evaluated.tasks.length} fixture tasks, ${plan.blocks.length} calendar blocks, bounded 21-day simulation.`);
