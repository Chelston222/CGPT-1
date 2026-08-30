import fs from 'node:fs';

export function hoursBetween(a, b) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 36e5;
}

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(Number(n)) ? Number(n) : 0));

function reviewWindowHours(task, config) {
  if (task.category === 'urgentCommercial' || task.urgency >= 85) return config.reviewWindowsHours.urgentCommercial;
  if (task.category === 'backburner') return config.reviewWindowsHours.backburner;
  if (task.category === 'projectAction') return config.reviewWindowsHours.projectAction;
  return config.reviewWindowsHours.normalExecution;
}

function freshnessScore(task, now, config) {
  const base = task.lastValidatedAt || task.createdAt || now;
  const age = Math.max(0, hoursBetween(base, now));
  const window = Math.max(1, reviewWindowHours(task, config));
  return clamp(100 * (1 - age / (window * 2)));
}

function priorityScore(task, now, config) {
  const w = config.priorityWeights;
  const duration = Math.max(15, Number(task.durationMinutes || 30));
  const dependencyUnlock = clamp(task.dependencyUnlock ?? 0);
  const confidence = clamp(task.relevanceConfidence ?? 80);
  const effortEfficiency = clamp(100 - Math.min(100, duration / 2));
  const parts = {
    strategicPriority: clamp(task.strategicPriority ?? 50),
    expectedValue: clamp(task.expectedValue ?? 50),
    impactProbability: clamp(task.impactProbability ?? 60),
    urgency: clamp(task.urgency ?? 50),
    dependencyUnlock,
    freshness: freshnessScore(task, now, config),
    confidence,
    effortEfficiency
  };
  return Math.round(Object.entries(w).reduce((sum, [k, weight]) => sum + parts[k] * weight, 0) * 100) / 100;
}

function decision(task, state, now, config, canonicalByFamily) {
  const out = { ...task, auditReason: null, supersededBy: task.supersededBy || null };
  const activeStatuses = new Set(['ACTIVE', 'OPEN', 'EXECUTE', 'SCHEDULE', 'BLOCKED', 'DEFER']);
  if (config.terminalStates.includes(task.status)) return out;

  if (task.outcomeSatisfied || state.outcomes?.some(o => o.id === task.desiredOutcome && o.satisfied)) {
    return { ...out, status: 'OBSOLETE', auditReason: 'Desired outcome is already satisfied.' };
  }
  if (task.supersededBy) return { ...out, status: 'SUPERSEDED', auditReason: `Superseded by ${task.supersededBy}.` };
  if (task.assumptionsValid === false) return { ...out, status: 'KILL', auditReason: 'Underlying assumptions are no longer valid.' };
  if (task.deadline && new Date(task.deadline) < new Date(now) && !task.deadlineCanSlip) {
    return { ...out, status: 'KILL', auditReason: 'Deadline passed; fail-closed prevents silent rollover.' };
  }
  if (task.notBefore && new Date(task.notBefore) > new Date(now)) {
    return { ...out, status: 'DEFER', auditReason: `Not executable before ${task.notBefore}.` };
  }
  if (task.recurrence && config.rules.recurrenceRequiresReview && task.recurrenceReviewAt && new Date(task.recurrenceReviewAt) <= new Date(now)) {
    return { ...out, status: 'DEFER', auditReason: 'Recurring contract review is due; recurrence loses scheduling privilege until revalidated.' };
  }
  const deps = task.dependencyIds || [];
  const unsatisfied = deps.filter(id => !state.tasks.some(t => t.id === id && ['COMPLETED', 'OBSOLETE'].includes(t.status)));
  if (unsatisfied.length) return { ...out, status: 'BLOCKED', auditReason: `Blocked by ${unsatisfied.join(', ')}.` };

  const familyKey = task.familyId || task.desiredOutcome;
  if (familyKey && config.rules.dedupeByFamilyId) {
    const canonical = canonicalByFamily.get(familyKey);
    if (canonical && canonical.id !== task.id) {
      return { ...out, status: 'MERGED', supersededBy: canonical.id, auditReason: `Merged into canonical task ${canonical.id}.` };
    }
  }

  const explicitNewer = state.tasks.find(t => (t.supersedesIds || []).includes(task.id) && !config.terminalStates.includes(t.status));
  if (explicitNewer) return { ...out, status: 'SUPERSEDED', supersededBy: explicitNewer.id, auditReason: `Explicitly superseded by newer task ${explicitNewer.id}.` };

  const age = Math.max(0, hoursBetween(task.lastValidatedAt || task.createdAt || now, now));
  if (task.missed && config.rules.missedTasksMustRevalidate && age > reviewWindowHours(task, config)) {
    return { ...out, status: 'DEFER', auditReason: 'Missed work exceeded its validation window and must be revalidated before rescheduling.' };
  }

  if (!activeStatuses.has(task.status || 'ACTIVE')) return out;
  return { ...out, status: 'EXECUTE', auditReason: 'Relevant, executable and eligible for dynamic ranking.' };
}

export function evaluateState(state, config) {
  const now = state.now || new Date().toISOString();
  const rawTasks = (state.tasks || []).map(t => ({ status: 'ACTIVE', ...t }));
  const canonicalByFamily = new Map();
  for (const task of [...rawTasks].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))) {
    const key = task.familyId || task.desiredOutcome;
    if (key && !canonicalByFamily.has(key)) canonicalByFamily.set(key, task);
  }
  const stateForEval = { ...state, tasks: rawTasks };
  const tasks = rawTasks.map(task => decision(task, stateForEval, now, config, canonicalByFamily));
  const ranked = tasks
    .filter(t => t.status === 'EXECUTE')
    .map(t => ({ ...t, priorityScore: priorityScore(t, now, config) }))
    .sort((a, b) => b.priorityScore - a.priorityScore || new Date(a.deadline || '9999-12-31') - new Date(b.deadline || '9999-12-31'));

  const terminalWithoutReason = tasks.filter(t => config.terminalStates.includes(t.status) && t.status !== 'COMPLETED' && !t.auditReason);
  const health = {
    totalTasks: tasks.length,
    executable: ranked.length,
    superseded: tasks.filter(t => t.status === 'SUPERSEDED').length,
    merged: tasks.filter(t => t.status === 'MERGED').length,
    killed: tasks.filter(t => ['KILL', 'OBSOLETE'].includes(t.status)).length,
    blocked: tasks.filter(t => t.status === 'BLOCKED').length,
    deferred: tasks.filter(t => t.status === 'DEFER').length,
    terminalWithoutReason: terminalWithoutReason.length,
    green: terminalWithoutReason.length === 0
  };
  return { now, tasks, ranked, health };
}

export function loadConfig(path = new URL('./config.json', import.meta.url)) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}
