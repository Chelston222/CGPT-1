import fs from 'node:fs';
import path from 'node:path';
import { evaluateState, loadConfig } from './engine.mjs';
import { planCalendar, renderIcs } from './calendar.mjs';
import { reconcileCalendar } from './reconcile.mjs';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node apps/agentic-os/run.mjs <state.json>');
  process.exit(2);
}

const state = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const config = loadConfig();
const evaluated = evaluateState(state, config);
const calendar = planCalendar(state, evaluated, config);
const reconciliation = reconcileCalendar({
  existingEvents: state.existingCalendarEvents || [],
  desiredBlocks: calendar.blocks,
  now: evaluated.now,
  freezeWindowMinutes: Number(state.freezeWindowMinutes ?? 120)
});

const health = {
  ...evaluated.health,
  calendarReconciliationGreen: reconciliation.health.green,
  calendarBlockers: reconciliation.health.blockers,
  green: evaluated.health.green && reconciliation.health.green
};

const output = {
  generatedAt: new Date().toISOString(),
  sourceNow: evaluated.now,
  health,
  capacity: calendar.capacity,
  tasks: evaluated.tasks,
  ranked: evaluated.ranked,
  calendarBlocks: calendar.blocks,
  reconciliation
};

const stateDir = path.resolve('apps/agentic-os/state');
fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(path.join(stateDir, 'latest.json'), JSON.stringify(output, null, 2));
fs.writeFileSync(path.join(stateDir, 'reconciliation.json'), JSON.stringify(reconciliation, null, 2));
fs.writeFileSync(path.join(stateDir, 'execution.ics'), renderIcs(calendar, config));

console.log(JSON.stringify({
  health: output.health,
  capacity: output.capacity,
  calendarBlocks: output.calendarBlocks.length,
  reconciliation: output.reconciliation.health
}, null, 2));
if (!output.health.green) process.exit(1);
