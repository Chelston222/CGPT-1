import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd(), '../..');
const paths = {
  worker: resolve(root, 'apps/tte-mail-bridge/scripts/process-queue.mjs'),
  ledger: resolve(root, 'apps/tte-mail-bridge/state/direct-ledger.json'),
  workflow: resolve(root, '.github/workflows/tte-direct-queue-runner.yml'),
  health: resolve(root, 'apps/tte-supervisor/state/health.json'),
};

const requiredWorkerTokens = [
  "If you'd rather I didn't follow up, just let me know.",
  'idempotency_key_mismatch',
  'IN_FLIGHT',
  'DELIVERY_PENDING',
  'QUARANTINED_TOMBSTONE',
  'SKIPPED_TOMBSTONE',
  'SENT_CONFIRMED',
];

const incidents = [];
function incident(code, severity, detail, repairClass = 'HOLD_AND_RECONCILE') {
  incidents.push({ code, severity, detail, repairClass });
}

for (const [name, path] of Object.entries(paths)) {
  if (name !== 'health' && !existsSync(path)) incident(`MISSING_${name.toUpperCase()}`, 'critical', path, 'SAFE_AUTO_FIX');
}

let worker = '';
if (existsSync(paths.worker)) {
  worker = readFileSync(paths.worker, 'utf8');
  for (const token of requiredWorkerTokens) {
    if (!worker.includes(token)) incident('WORKER_SAFETY_CONTRACT_REGRESSION', 'critical', `Missing required worker contract token: ${token}`, 'SAFE_AUTO_FIX');
  }
  if (/QUARANTINED_TOMBSTONE[^\n]{0,300}HELD_IDEMPOTENCY/s.test(worker) && !worker.includes("case 'SKIPPED_TOMBSTONE'")) {
    incident('TOMBSTONE_STARVATION_RISK', 'critical', 'A quarantined tombstone can stop later valid controls.', 'SAFE_AUTO_FIX');
  }
}

let ledger = null;
if (existsSync(paths.ledger)) {
  try { ledger = JSON.parse(readFileSync(paths.ledger, 'utf8')); }
  catch (error) { incident('DIRECT_LEDGER_UNREADABLE', 'critical', String(error?.message || error)); }
}

if (ledger) {
  if (!ledger.idempotency || typeof ledger.idempotency !== 'object') incident('DIRECT_LEDGER_NO_IDEMPOTENCY_MAP', 'critical', 'direct-ledger.json lacks idempotency object');
  for (const [key, value] of Object.entries(ledger.idempotency || {})) {
    if (value?.idempotencyKey && value.idempotencyKey !== key) incident('DIRECT_LEDGER_KEY_MISMATCH', 'critical', `${key} != ${value.idempotencyKey}`);
    if (value?.state === 'IN_FLIGHT') incident('DIRECT_IN_FLIGHT', 'critical', `${key} remains IN_FLIGHT; never auto-reroute or retry.`);
    if (value?.state === 'DELIVERY_PENDING') incident('DIRECT_DELIVERY_PENDING', 'critical', `${key} has ambiguous delivery outcome; never auto-reroute or retry.`);
  }
}

let workflow = '';
if (existsSync(paths.workflow)) {
  workflow = readFileSync(paths.workflow, 'utf8');
  for (const token of ['contents: write', 'cancel-in-progress: false', 'TTE_SMTP_PASS', 'process-queue.mjs']) {
    if (!workflow.includes(token)) incident('DIRECT_WORKFLOW_CONTRACT_REGRESSION', 'critical', `Missing workflow contract token: ${token}`, 'SAFE_AUTO_FIX');
  }
}

const critical = incidents.filter((x) => x.severity === 'critical');
const health = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  state: critical.length ? 'BLOCKED' : 'HEALTHY',
  incidentCount: incidents.length,
  criticalCount: critical.length,
  incidents,
  invariants: {
    workerPresent: existsSync(paths.worker),
    ledgerPresent: existsSync(paths.ledger),
    workflowPresent: existsSync(paths.workflow),
    mandatoryOptOutEnforced: worker.includes("If you'd rather I didn't follow up, just let me know."),
    tombstonesSkipSafely: worker.includes('SKIPPED_TOMBSTONE'),
    ambiguousStatesFailClosed: worker.includes('IN_FLIGHT') && worker.includes('DELIVERY_PENDING'),
  },
};

mkdirSync(dirname(paths.health), { recursive: true });
writeFileSync(paths.health, `${JSON.stringify(health, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(health, null, 2));
if (critical.length) process.exitCode = 2;
