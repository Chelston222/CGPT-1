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

function outcomeSatisfiedForTask(task, state) {
  if (task.outcomeSatisfied) return true;
  const keys = new Set([task.desiredOutcomeId, task.desiredOutcome].filter(Boolean));
  return (state.outcomes || []).some(o => o.satisfied && (keys.has(o.id) || keys.has(o.key) || keys.has(o.name)));
}

function dependencySatisfied(id, state) {
  const dep = state.tasks.find(t => t.id === id);
  if (!dep) return false;
  if (['COMPLETED', 'OBSOLETE'].includes(dep.status)) return true;
  return outcomeSatisfiedForTask(dep, state);
}

function recurrenceReview(task, now, config) {
  if (!task.recurrence || !config.rules.recurrenceRequiresReview || !task.recurrenceReviewAt) {
    return { task, terminal: null };
  }
  if (new Date(task.recurrenceReviewAt) > new Date(now)) return { task, terminal: null };

  const decision = String(task.recurrenceReviewDecision || '').toUpperCase();
  const decidedAt = task.recurrenceReviewDecidedAt ? new Date(task.recurrenceReviewDecidedAt) : null;
  const reviewDueAt = new Date(task.recurrenceReviewAt);
  const hasCurrentDecision = decision && decidedAt && decidedAt >= reviewDueAt;

  if (!hasCurrentDecision) {
    return {
      task,
      terminal: { ...task, status: 'DEFER', auditReason: 'Recurring contract review is due; recurrence loses scheduling privilege until revalidated.' }
    };
  }

  if (decision === 'RETIRE') {
    return {
      task,
      terminal: { ...task, status: 'KILL', recurrenceDisposition: 'RETIRE', auditReason: 'Recurring contract review retired this action.' }
    };
  }

  if (decision === 'PAUSE') {
    return {
      task,
      terminal: {
        ...task,
        status: 'DEFER',
        recurrenceDisposition: 'PAUSE',
        auditReason: task.nextRecurrenceReviewAt
          ? `Recurring contract review paused this action until review at ${task.nextRecurrenceReviewAt}.`
          : 'Recurring contract review paused this action; scheduling privilege is removed until revalidated.'
      }
    };
  }

  if (decision === 'REDUCE') {
    if (!task.reducedRecurrence) {
      return {
        task,
        terminal: { ...task, status: 'DEFER', recurrenceDisposition: 'REDUCE', auditReason: 'Recurring contract review requested reduced cadence but no reducedRecurrence was supplied; fail closed.' }
      };
    }
    const nextReview = task.nextRecurrenceReviewAt || null;
    return {
      task: {
        ...task,
        recurrence: task.reducedRecurrence,
        recurrenceDisposition: 'REDUCE',
        recurrenceReviewAt: nextReview,
        auditReason: `Recurring contract review reduced cadence to ${task.reducedRecurrence}.`
      },
      terminal: null
    };
  }

  if (decision === 'CONTINUE') {
    if (!task.nextRecurrenceReviewAt || new Date(task.nextRecurrenceReviewAt) <= new Date(now)) {
      return {
        task,
        terminal: { ...task, status: 'DEFER', recurrenceDisposition: 'CONTINUE', auditReason: 'Recurring contract review chose CONTINUE but no future nextRecurrenceReviewAt was supplied; fail closed.' }
      };
    }
    return {
      task: {
        ...task,
        recurrenceDisposition: 'CONTINUE',
        recurrenceReviewAt: task.nextRecurrenceReviewAt,
        auditReason: `Recurring contract review continued this action until next review at ${task.nextRecurrenceReviewAt}.`
      },
      terminal: null
    };
  }

  return {
    task,
    terminal: { ...task, status: 'DEFER', auditReason: `Unsupported recurrence review decision ${decision || '(missing)'}; fail closed.` }
  };
}

function decision(task, state, now, config, canonicalByFamily) {
  const out = { ...task, auditReason: null, supersededBy: task.supersededBy || null };
  const activeStatuses = new Set(['ACTIVE', 'OPEN', 'EXECUTE', 'SCHEDULE', 'BLOCKED', 'DEFER']);
  if (config.terminalStates.includes(task.status)) return out;

  if (outcomeSatisfiedForTask(task, state)) {
    return { ...out, status: 'OBSOLETE', auditReason: 'Desired outcome is already satisfied.' };
  }
  if (task.supersededBy) return { ...out, status: 'SUPERSEDED', auditReason: `Superseded by ${task.supersededBy}.` };
  if (task.assumptionsValid === false) return { ...out, status: 'KILL', auditReason: 'Underlying assumptions are no longer valid.' };
  if (task.deadline && new Date(task.deadline) < new Date(now) && !task.deadlineCanSlip) {
    return { ...out, status: 'KILL', auditReason: 'Deadline passed; fail-closed prevents silent rollover.' };
  }
  if (task.sourceFresh === false || String(task.sourceState || '').toUpperCase() === 'STALE' || String(task.integrationState || '').toUpperCase() === 'STALE') {
    return { ...out, status: 'DEFER', auditReason: 'Source or integration evidence is stale; fail closed until refreshed.' };
  }
  if (task.notBefore && new Date(task.notBefore) > new Date(now)) {
    return { ...out, status: 'DEFER', auditReason: `Not executable before ${task.notBefore}.` };
  }

  const recurrence = recurrenceReview(out, now, config);
  if (recurrence.terminal) return recurrence.terminal;
  const reviewed = recurrence.task;

  const deps = reviewed.dependencyIds || [];
  const unsatisfied = deps.filter(id => !dependencySatisfied(id, state));
  if (unsatisfied.length) return { ...reviewed, status: 'BLOCKED', auditReason: `Blocked by ${unsatisfied.join(', ')}.` };

  const familyKey = reviewed.familyId || reviewed.desiredOutcomeId || reviewed.desiredOutcome;
  if (familyKey && config.rules.dedupeByFamilyId) {
    const canonical = canonicalByFamily.get(familyKey);
    if (canonical && canonical.id !== reviewed.id) {
      return { ...reviewed, status: 'MERGED', supersededBy: canonical.id, auditReason: `Merged into canonical task ${canonical.id}.` };
    }
  }

  const explicitNewer = state.tasks.find(t => (t.supersedesIds || []).includes(reviewed.id) && !config.terminalStates.includes(t.status));
  if (explicitNewer) return { ...reviewed, status: 'SUPERSEDED', supersededBy: explicitNewer.id, auditReason: `Explicitly superseded by newer task ${explicitNewer.id}.` };

  const age = Math.max(0, hoursBetween(reviewed.lastValidatedAt || reviewed.createdAt || now, now));
  if (reviewed.missed && config.rules.missedTasksMustRevalidate && age > reviewWindowHours(reviewed, config)) {
    return { ...reviewed, status: 'DEFER', auditReason: 'Missed work exceeded its validation window and must be revalidated before rescheduling.' };
  }

  if (!activeStatuses.has(reviewed.status || 'ACTIVE')) return reviewed;
  return {
    ...reviewed,
    status: 'EXECUTE',
    auditReason: reviewed.recurrenceDisposition
      ? `${reviewed.auditReason} Relevant, executable and eligible for dynamic ranking.`
      : 'Relevant, executable and eligible for dynamic ranking.'
  };
}

export function evaluateState(state, config) {
  const now = state.now || new Date().toISOString();
  const rawTasks = (state.tasks || []).map(t => ({ status: 'ACTIVE', ...t }));
  const canonicalByFamily = new Map();
  const canonicalCandidates = rawTasks
    .filter(t => !config.terminalStates.includes(t.status))
    .sort((a, b) => {
      const aFresh = new Date(a.lastValidatedAt || a.createdAt || 0).getTime();
      const bFresh = new Date(b.lastValidatedAt || b.createdAt || 0).getTime();
      return bFresh - aFresh;
    });
  for (const task of canonicalCandidates) {
    const key = task.familyId || task.desiredOutcomeId || task.desiredOutcome;
    if (key && !canonicalByFamily.has(key)) canonicalByFamily.set(key, task);
  }
  const stateForEval = { ...state, tasks: rawTasks };
  const tasks = rawTasks.map(task => decision(task, stateForEval, now, config, canonicalByFamily));
  const ranked = tasks
    .filter(t => t.status === 'EXECUTE')
    .map(t => ({ ...t, priorityScore: priorityScore(t, now, config) }))
    .sort((a, b) => b.priorityScore - a.priorityScore || new Date(a.deadline || '9999-12-31') - new Date(b.deadline || '9999-12-31'));

  const terminalWithoutReason = tasks.filter(t => config.terminalStates.includes(t.status) && t.status !== 'COMPLETED' && !t.auditReason);
  const executableIds = new Set(ranked.map(t => t.id));
  const duplicateExecutableFamilies = new Map();
  for (const t of tasks.filter(t => executableIds.has(t.id))) {
    const key = t.familyId || t.desiredOutcomeId || t.desiredOutcome;
    if (!key) continue;
    duplicateExecutableFamilies.set(key, (duplicateExecutableFamilies.get(key) || 0) + 1);
  }
  const duplicateExecutableCount = [...duplicateExecutableFamilies.values()].filter(n => n > 1).length;
  const health = {
    totalTasks: tasks.length,
    executable: ranked.length,
    superseded: tasks.filter(t => t.status === 'SUPERSEDED').length,
    merged: tasks.filter(t => t.status === 'MERGED').length,
    killed: tasks.filter(t => ['KILL', 'OBSOLETE'].includes(t.status)).length,
    blocked: tasks.filter(t => t.status === 'BLOCKED').length,
    deferred: tasks.filter(t => t.status === 'DEFER').length,
    terminalWithoutReason: terminalWithoutReason.length,
    duplicateExecutableFamilies: duplicateExecutableCount,
    green: terminalWithoutReason.length === 0 && duplicateExecutableCount === 0
  };
  return { now, tasks, ranked, health };
}

export function loadConfig(path = new URL('./config.json', import.meta.url)) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}
