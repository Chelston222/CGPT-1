'use strict';

const crypto = require('node:crypto');
const { localDate, weekKeyFromLocalDate } = require('./linkedin-buffer-capacity.cjs');

const TARGETS = ['personal', 'main', 'secondary'];
const DEFAULT_LIMITS = Object.freeze({
  personal: Object.freeze({ maxPerDay: 2, maxPerWeek: 14 }),
  main: Object.freeze({ maxPerDay: 1, maxPerWeek: 5 }),
  secondary: Object.freeze({ maxPerDay: 1, maxPerWeek: 5 }),
});
const BUFFER_SCHEDULED_LIMIT_PER_CHANNEL = 10;
const PAST_DUE_GRACE_MS = 15 * 60 * 1000;

function queueKey(id, revision) {
  return `${id}@${revision}`;
}

function placementKey(id, revision, target) {
  return `${queueKey(id, revision)}:${target}`;
}

function limitsFromPolicy(policy = {}) {
  return Object.fromEntries(TARGETS.map((target) => {
    const account = policy.accounts?.[target] || {};
    const fallback = DEFAULT_LIMITS[target];
    const maxPerDay = Number(account.maximumPerDay);
    const maxPerWeek = Number(account.maximumPerWeek);
    return [target, {
      maxPerDay: Number.isFinite(maxPerDay) && maxPerDay > 0 ? maxPerDay : fallback.maxPerDay,
      maxPerWeek: Number.isFinite(maxPerWeek) && maxPerWeek > 0 ? maxPerWeek : fallback.maxPerWeek,
    }];
  }));
}

function normaliseLedger(ledgerEntries = []) {
  const ledger = new Map();
  const duplicates = [];
  for (const entry of ledgerEntries) {
    if (!entry?.bufferId) continue;
    if (ledger.has(entry.bufferId)) duplicates.push(entry.bufferId);
    ledger.set(entry.bufferId, entry);
  }
  return { ledger, duplicates };
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function addCount(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function mediaIntegrity(locked = {}) {
  return {
    sha256: locked.mediaSha256 || locked.carousel?.pdfSha256 || '',
    bytes: locked.mediaBytes ?? locked.carousel?.pdfBytes ?? null,
  };
}

function buildIntegrityReport({
  livePosts = [],
  queuePosts = [],
  ledgerEntries = [],
  channelIds = {},
  policy = {},
  providerStates = {},
  timeZone = policy.timezone || 'Europe/London',
  now = Date.now(),
} = {}) {
  const failures = [];
  const warnings = [];
  const limits = limitsFromPolicy(policy);
  const targetByChannel = Object.fromEntries(Object.entries(channelIds).map(([target, id]) => [id, target]));
  const { ledger, duplicates: duplicateLedgerBufferIds } = normaliseLedger(ledgerEntries);
  const queueByKey = new Map();
  const duplicateQueueKeys = [];

  for (const post of queuePosts) {
    const key = queueKey(post.id, post.revision);
    if (queueByKey.has(key)) duplicateQueueKeys.push(key);
    queueByKey.set(key, post);
  }

  if (duplicateQueueKeys.length) failures.push(`Duplicate locked queue revision(s): ${[...new Set(duplicateQueueKeys)].join(', ')}`);
  if (duplicateLedgerBufferIds.length) failures.push(`Duplicate Buffer acceptance ledger ID(s): ${[...new Set(duplicateLedgerBufferIds)].join(', ')}`);

  for (const target of TARGETS) {
    const expectedId = channelIds[target];
    if (!expectedId) failures.push(`Missing configured Buffer channel ID for ${target}.`);
    const provider = providerStates[target];
    if (!provider) {
      failures.push(`No live provider state was resolved for ${target}.`);
      continue;
    }
    if (provider.id && expectedId && provider.id !== expectedId) failures.push(`${target} provider ID drifted from the configured channel ID.`);
    if (provider.connected === false) failures.push(`${target} Buffer channel is disconnected, locked or paused.`);
    if (provider.timezonePass === false) failures.push(`${target} Buffer timezone is not ${timeZone}.`);
    if (provider.identityPass === false) failures.push(`${target} Buffer channel identity does not match its governed role.`);
    if (Number.isFinite(provider.recurringSlots) && provider.recurringSlots > limits[target].maxPerWeek) {
      failures.push(`${target} recurring Buffer schedule has ${provider.recurringSlots} slots, above the governed ${limits[target].maxPerWeek}/week ceiling.`);
    }
  }

  const seenBufferIds = new Set();
  const seenPlacementKeys = new Map();
  const daily = new Map();
  const weekly = new Map();
  const counts = Object.fromEntries(TARGETS.map((target) => [target, 0]));
  const rows = [];

  for (const live of livePosts) {
    const bufferId = String(live.id || '');
    if (!bufferId) {
      failures.push('Buffer returned a scheduled placement without an ID.');
      continue;
    }
    if (seenBufferIds.has(bufferId)) failures.push(`Duplicate live Buffer post ID ${bufferId}.`);
    seenBufferIds.add(bufferId);

    const target = targetByChannel[live.channelId] || 'UNKNOWN';
    if (target === 'UNKNOWN') failures.push(`Buffer post ${bufferId} belongs to an unknown channel ${live.channelId || '(missing)'}.`);
    else counts[target] += 1;

    const ledgerEntry = ledger.get(bufferId) || null;
    if (!ledgerEntry) failures.push(`Buffer post ${bufferId} has no trusted approval/acceptance ledger mapping.`);
    const locked = ledgerEntry ? queueByKey.get(queueKey(ledgerEntry.queueId, ledgerEntry.revision)) || null : null;
    if (ledgerEntry && !locked) failures.push(`Buffer post ${bufferId} maps to missing locked queue revision ${queueKey(ledgerEntry.queueId, ledgerEntry.revision)}.`);

    if (locked && target !== 'UNKNOWN') {
      if (!Array.isArray(locked.targets) || !locked.targets.includes(target)) {
        failures.push(`${queueKey(locked.id, locked.revision)} does not authorise target ${target}.`);
      }
      if (locked.mode !== 'schedule') failures.push(`${queueKey(locked.id, locked.revision)} is live in Buffer but queue mode is ${locked.mode || '(missing)'}, not schedule.`);

      const expectedDue = locked.scheduledAt?.[target];
      const expectedMs = Date.parse(expectedDue || '');
      const liveMs = Date.parse(live.dueAt || '');
      if (!Number.isFinite(expectedMs)) failures.push(`${queueKey(locked.id, locked.revision)} has no valid locked schedule for ${target}.`);
      if (!Number.isFinite(liveMs)) failures.push(`Buffer post ${bufferId} has no valid due time.`);
      if (Number.isFinite(expectedMs) && Number.isFinite(liveMs) && expectedMs !== liveMs) {
        failures.push(`${queueKey(locked.id, locked.revision)} / ${target} due-time drift: queue ${expectedDue}, Buffer ${live.dueAt}.`);
      }

      const key = placementKey(locked.id, locked.revision, target);
      if (seenPlacementKeys.has(key) && seenPlacementKeys.get(key) !== bufferId) {
        failures.push(`Duplicate live destination for ${key}: Buffer IDs ${seenPlacementKeys.get(key)} and ${bufferId}.`);
      }
      seenPlacementKeys.set(key, bufferId);

      if (locked.mediaUrl) {
        const integrity = mediaIntegrity(locked);
        if (!isHttpsUrl(locked.mediaUrl)) failures.push(`${queueKey(locked.id, locked.revision)} mediaUrl is not HTTPS.`);
        if (!/^[a-f0-9]{64}$/i.test(String(integrity.sha256 || ''))) failures.push(`${queueKey(locked.id, locked.revision)} is missing a valid media SHA-256.`);
        if (!Number.isFinite(Number(integrity.bytes)) || Number(integrity.bytes) <= 0) failures.push(`${queueKey(locked.id, locked.revision)} is missing a valid media byte count.`);
      }
    }

    const dueMs = Date.parse(live.dueAt || '');
    if (Number.isFinite(dueMs) && dueMs < now - PAST_DUE_GRACE_MS) failures.push(`Buffer post ${bufferId} is still scheduled more than 15 minutes past due.`);
    if (live.isCustomScheduled === false || (live.shareMode && live.shareMode !== 'customScheduled')) {
      failures.push(`Buffer post ${bufferId} is not protected as a fixed custom-scheduled placement.`);
    }

    if (target !== 'UNKNOWN' && Number.isFinite(dueMs)) {
      const date = localDate(live.dueAt, timeZone);
      const week = weekKeyFromLocalDate(date);
      addCount(daily, `${date}:${target}`);
      addCount(weekly, `${week}:${target}`);
    }

    rows.push({
      bufferId,
      target,
      dueAt: live.dueAt || null,
      queueId: ledgerEntry?.queueId || null,
      revision: ledgerEntry?.revision || null,
      approvalIssue: ledgerEntry?.approvalIssue || null,
      title: locked?.title || null,
      mapped: Boolean(ledgerEntry && locked),
    });
  }

  for (const [key, count] of daily) {
    const target = key.split(':').at(-1);
    if (count > limits[target].maxPerDay) failures.push(`${key} has ${count} live placements, above ${limits[target].maxPerDay}/day.`);
  }
  for (const [key, count] of weekly) {
    const target = key.split(':').at(-1);
    if (count > limits[target].maxPerWeek) failures.push(`${key} has ${count} live placements, above ${limits[target].maxPerWeek}/week.`);
  }
  for (const target of TARGETS) {
    if (counts[target] > BUFFER_SCHEDULED_LIMIT_PER_CHANNEL) failures.push(`${target} has ${counts[target]} scheduled Buffer posts, above the ${BUFFER_SCHEDULED_LIMIT_PER_CHANNEL}-post capacity ceiling.`);
    if (counts[target] === 0) warnings.push(`${target} currently has no scheduled Buffer runway.`);
  }

  rows.sort((a, b) => String(a.dueAt || '').localeCompare(String(b.dueAt || '')) || a.target.localeCompare(b.target));
  const fingerprint = crypto.createHash('sha256')
    .update(rows.map((row) => [row.bufferId, row.target, row.dueAt, row.queueId, row.revision, row.approvalIssue].join('|')).join('\n'))
    .digest('hex');

  return {
    ok: failures.length === 0,
    failures,
    warnings,
    rows,
    counts,
    fingerprint,
    mappedCount: rows.filter((row) => row.mapped).length,
    totalCount: rows.length,
    cadence: {
      daily: Object.fromEntries([...daily.entries()].sort()),
      weekly: Object.fromEntries([...weekly.entries()].sort()),
    },
  };
}

module.exports = {
  BUFFER_SCHEDULED_LIMIT_PER_CHANNEL,
  DEFAULT_LIMITS,
  PAST_DUE_GRACE_MS,
  buildIntegrityReport,
  limitsFromPolicy,
  mediaIntegrity,
  placementKey,
  queueKey,
};
