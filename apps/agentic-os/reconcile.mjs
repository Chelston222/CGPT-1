import crypto from 'node:crypto';
import { renderIcs } from './calendar.mjs';

const ms = minutes => minutes * 60_000;
const clean = value => String(value ?? '').trim();

function extractMarker(description, key) {
  const match = clean(description).match(new RegExp(`\\b${key}=([^\\s]+)`));
  return match ? match[1] : null;
}

export function parseOwnership(event) {
  const title = clean(event.summary || event.title);
  const description = clean(event.description);
  const hasPrefix = title.startsWith('AOS |');
  const owner = extractMarker(description, 'AOS_OWNER');
  const actionId = extractMarker(description, 'AOS_ACTION_ID');
  const blockId = extractMarker(description, 'AOS_BLOCK_ID');
  const owned = hasPrefix && owner === 'agentic-os' && Boolean(actionId);
  const ambiguous = hasPrefix && !owned;
  return { owned, ambiguous, owner, actionId, blockId, title };
}

function eventStart(event) {
  return new Date(event.start?.dateTime || event.start);
}

function eventEnd(event) {
  return new Date(event.end?.dateTime || event.end);
}

function sameInstant(a, b) {
  return new Date(a).getTime() === new Date(b).getTime();
}

function desiredDescription(block) {
  return clean(block.description);
}

function requiresUpdate(event, block) {
  const currentTitle = clean(event.summary || event.title);
  if (currentTitle !== clean(block.title)) return true;
  if (!sameInstant(eventStart(event), block.start)) return true;
  if (!sameInstant(eventEnd(event), block.end)) return true;

  const ownership = parseOwnership(event);
  if (ownership.actionId !== clean(block.actionId || block.taskId)) return true;
  if (block.aosId && ownership.blockId && ownership.blockId !== clean(block.aosId)) return true;
  if (!clean(event.description).includes('AOS_OWNER=agentic-os')) return true;
  if (desiredDescription(block) && clean(event.description) !== desiredDescription(block)) return true;
  return false;
}

function desiredGroups(blocks) {
  const groups = new Map();
  for (const block of blocks || []) {
    const actionId = clean(block.actionId || block.taskId);
    if (!actionId) throw new Error('Every desired AOS block requires actionId or taskId.');
    const enriched = { ...block, actionId };
    if (!groups.has(actionId)) groups.set(actionId, []);
    groups.get(actionId).push(enriched);
  }
  return groups;
}

function existingGroups(events) {
  const groups = new Map();
  const manual = [];
  const ambiguous = [];
  for (const event of events || []) {
    const ownership = parseOwnership(event);
    if (ownership.ambiguous) {
      ambiguous.push({ event, reason: 'AOS-prefixed event lacks unambiguous Agentic OS ownership markers.' });
      continue;
    }
    if (!ownership.owned) {
      manual.push(event);
      continue;
    }
    if (!groups.has(ownership.actionId)) groups.set(ownership.actionId, []);
    groups.get(ownership.actionId).push({ event, ownership });
  }
  return { groups, manual, ambiguous };
}

export function reconcileCalendar({ existingEvents = [], desiredBlocks = [], now = new Date().toISOString(), freezeWindowMinutes = 120 } = {}) {
  const desired = desiredGroups(desiredBlocks);
  const existing = existingGroups(existingEvents);
  const creates = [];
  const updates = [];
  const deletes = [];
  const noops = [];
  const retained = [];
  const blockers = existing.ambiguous.map(x => ({ type: 'AMBIGUOUS_OWNERSHIP', eventId: x.event.id, reason: x.reason }));
  const matchedEventIds = new Set();

  for (const [actionId, wanted] of desired.entries()) {
    const live = existing.groups.get(actionId) || [];

    if (wanted.length === 1) {
      if (live.length === 0) {
        creates.push({ actionId, desired: wanted[0], reason: 'No existing owned event for desired action.' });
        continue;
      }
      if (live.length > 1) {
        blockers.push({
          type: 'DUPLICATE_OWNED_EVENTS',
          actionId,
          eventIds: live.map(x => x.event.id),
          reason: 'Multiple owned events share one action ID; fail closed instead of guessing which to mutate.'
        });
        for (const item of live) matchedEventIds.add(item.event.id);
        continue;
      }
      const item = live[0];
      matchedEventIds.add(item.event.id);
      if (requiresUpdate(item.event, wanted[0])) {
        updates.push({ eventId: item.event.id, actionId, desired: wanted[0], reason: 'Owned event differs from desired block.' });
      } else {
        noops.push({ eventId: item.event.id, actionId, reason: 'Owned event already matches desired block.' });
      }
      continue;
    }

    const desiredByBlock = new Map();
    let desiredBlockIdsValid = true;
    for (const block of wanted) {
      if (!block.aosId || desiredByBlock.has(block.aosId)) desiredBlockIdsValid = false;
      desiredByBlock.set(block.aosId, block);
    }
    const existingByBlock = new Map();
    let existingBlockIdsValid = true;
    for (const item of live) {
      const blockId = item.ownership.blockId;
      if (!blockId || existingByBlock.has(blockId)) existingBlockIdsValid = false;
      existingByBlock.set(blockId, item);
    }

    if (!desiredBlockIdsValid || (live.length && !existingBlockIdsValid)) {
      blockers.push({
        type: 'AMBIGUOUS_SEGMENT_IDENTITY',
        actionId,
        reason: 'Multi-segment actions require unique AOS_BLOCK_ID markers on desired and existing blocks.'
      });
      for (const item of live) matchedEventIds.add(item.event.id);
      continue;
    }

    for (const [blockId, block] of desiredByBlock.entries()) {
      const item = existingByBlock.get(blockId);
      if (!item) {
        creates.push({ actionId, blockId, desired: block, reason: 'Desired action segment has no existing owned event.' });
        continue;
      }
      matchedEventIds.add(item.event.id);
      if (requiresUpdate(item.event, block)) {
        updates.push({ eventId: item.event.id, actionId, blockId, desired: block, reason: 'Owned segment differs from desired block.' });
      } else {
        noops.push({ eventId: item.event.id, actionId, blockId, reason: 'Owned segment already matches desired block.' });
      }
    }

    for (const [blockId, item] of existingByBlock.entries()) {
      if (!desiredByBlock.has(blockId)) {
        matchedEventIds.add(item.event.id);
      }
    }
  }

  const freezeAt = new Date(new Date(now).getTime() + ms(freezeWindowMinutes));
  for (const [actionId, items] of existing.groups.entries()) {
    for (const item of items) {
      if (matchedEventIds.has(item.event.id)) continue;
      const start = eventStart(item.event);
      const end = eventEnd(item.event);
      if (end <= new Date(now)) {
        retained.push({ eventId: item.event.id, actionId, reason: 'Past owned event retained for history.' });
      } else if (start <= freezeAt) {
        retained.push({ eventId: item.event.id, actionId, reason: `Owned event is inside ${freezeWindowMinutes}-minute freeze window.` });
      } else {
        deletes.push({ eventId: item.event.id, actionId, reason: 'Owned future event is no longer present in desired plan.' });
      }
    }
  }

  return {
    creates,
    updates,
    deletes,
    noops,
    retained,
    blockers,
    ignoredManualCount: existing.manual.length,
    health: {
      green: blockers.length === 0,
      creates: creates.length,
      updates: updates.length,
      deletes: deletes.length,
      noops: noops.length,
      retained: retained.length,
      blockers: blockers.length,
      ignoredManual: existing.manual.length
    }
  };
}

export function renderOwnedEventsIcs(events, config, generatedAt = new Date()) {
  const blocks = [];
  for (const event of events || []) {
    const ownership = parseOwnership(event);
    if (!ownership.owned) continue;
    const start = eventStart(event);
    const end = eventEnd(event);
    if (!(end > generatedAt)) continue;
    const aosId = ownership.blockId || crypto.createHash('sha256').update(`${ownership.actionId}|live`).digest('hex').slice(0, 24);
    blocks.push({
      aosId,
      actionId: ownership.actionId,
      taskId: ownership.actionId,
      title: clean(event.summary || event.title),
      start: start.toISOString(),
      end: end.toISOString(),
      description: clean(event.description)
    });
  }
  blocks.sort((a, b) => new Date(a.start) - new Date(b.start));
  return renderIcs({ blocks }, config, generatedAt);
}
