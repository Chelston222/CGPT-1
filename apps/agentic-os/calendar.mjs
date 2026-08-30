import crypto from 'node:crypto';

const mins = m => m * 60_000;
const iso = d => new Date(d).toISOString();
const escapeIcs = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const icsDate = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}

function timeZoneOffsetMs(date, timeZone) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function parseClockOnDate(dateIso, hhmm, timeZone) {
  const base = new Date(dateIso);
  const local = zonedParts(base, timeZone);
  const [hour, minute] = hhmm.split(':').map(Number);
  const wallClockAsUtc = Date.UTC(local.year, local.month - 1, local.day, hour, minute, 0, 0);
  let candidate = new Date(wallClockAsUtc);
  for (let i = 0; i < 3; i++) {
    candidate = new Date(wallClockAsUtc - timeZoneOffsetMs(candidate, timeZone));
  }
  return candidate;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .map(x => ({ start: new Date(x.start), end: new Date(x.end) }))
    .filter(x => x.end > x.start)
    .sort((a, b) => a.start - b.start);
  const out = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (!last || cur.start > last.end) out.push(cur);
    else if (cur.end > last.end) last.end = cur.end;
  }
  return out;
}

export function freeWindows(state, config) {
  const now = new Date(state.now || new Date());
  const dayStart = parseClockOnDate(now, config.defaultWorkday.start, config.timezone);
  const dayEnd = parseClockOnDate(now, config.defaultWorkday.end, config.timezone);
  if (dayEnd <= dayStart) dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  const busy = mergeIntervals((state.hardCommitments || []).filter(e => overlaps(dayStart, dayEnd, new Date(e.start), new Date(e.end))));
  const windows = [];
  let cursor = dayStart > now ? dayStart : now;
  for (const b of busy) {
    if (b.end <= cursor) continue;
    if (b.start > cursor) windows.push({ start: new Date(cursor), end: new Date(b.start) });
    cursor = new Date(Math.max(cursor.getTime(), b.end.getTime()));
  }
  if (cursor < dayEnd) windows.push({ start: cursor, end: dayEnd });
  return windows.filter(w => (w.end - w.start) >= mins(config.minimumBlockMinutes));
}

export function planCalendar(state, evaluated, config) {
  const windows = freeWindows(state, config);
  const totalFree = windows.reduce((s, w) => s + (w.end - w.start), 0);
  const usableBudget = totalFree * (1 - config.normalSlackPercent / 100);
  let used = 0;
  let wi = 0;
  let cursor = windows[0] ? new Date(windows[0].start) : null;
  const blocks = [];

  for (const task of evaluated.ranked) {
    if (!cursor || used >= usableBudget) break;
    const requested = Math.max(config.minimumBlockMinutes, Math.min(config.maximumBlockMinutes, Number(task.durationMinutes || 30)));
    let remaining = mins(requested);
    let segmentIndex = 0;
    while (remaining > 0 && wi < windows.length && used < usableBudget) {
      const w = windows[wi];
      if (cursor < w.start) cursor = new Date(w.start);
      if (cursor >= w.end) { wi += 1; cursor = windows[wi] ? new Date(windows[wi].start) : null; continue; }
      const available = w.end - cursor;
      const budgetLeft = usableBudget - used;
      const chunk = Math.min(remaining, available, budgetLeft, mins(config.maximumBlockMinutes));
      if (chunk < mins(config.minimumBlockMinutes)) { wi += 1; cursor = windows[wi] ? new Date(windows[wi].start) : null; continue; }
      const start = new Date(cursor);
      const end = new Date(start.getTime() + chunk);
      const actionId = String(task.actionId || task.id);
      const aosId = crypto.createHash('sha256').update(`${actionId}|segment:${segmentIndex}`).digest('hex').slice(0, 24);
      blocks.push({
        aosId,
        actionId,
        segmentIndex,
        taskId: task.id,
        title: task.calendarTitle || `AOS | ${task.title}`,
        start: iso(start),
        end: iso(end),
        priorityScore: task.priorityScore,
        description: `AOS_OWNER=agentic-os\nAOS_ACTION_ID=${actionId}\nAOS_BLOCK_ID=${aosId}\nOutcome: ${task.desiredOutcome || task.title}\nTask: ${task.id}\nPriority: ${task.priorityScore}\nOwned by Agentic OS. Manual events must not be mutated.`
      });
      used += chunk;
      remaining -= chunk;
      cursor = end;
      segmentIndex += 1;
    }
  }

  return {
    blocks,
    capacity: {
      totalFreeMinutes: Math.floor(totalFree / 60_000),
      scheduledMinutes: Math.floor(used / 60_000),
      protectedSlackMinutes: Math.max(0, Math.floor((totalFree - usableBudget) / 60_000)),
      utilisationOfFreePercent: totalFree ? Math.round((used / totalFree) * 10000) / 100 : 0
    }
  };
}

export function renderIcs(plan, config, generatedAt = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chelston222//Agentic OS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(config.calendarName)}`,
    `X-WR-TIMEZONE:${escapeIcs(config.timezone)}`
  ];
  for (const b of plan.blocks) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${b.aosId}@agentic-os`);
    lines.push(`DTSTAMP:${icsDate(generatedAt)}`);
    lines.push(`DTSTART:${icsDate(b.start)}`);
    lines.push(`DTEND:${icsDate(b.end)}`);
    lines.push(`SUMMARY:${escapeIcs(b.title)}`);
    lines.push(`DESCRIPTION:${escapeIcs(b.description)}`);
    lines.push(`X-AOS-ID:${b.aosId}`);
    lines.push(`X-AOS-ACTION-ID:${escapeIcs(b.actionId)}`);
    lines.push(`X-AOS-TASK-ID:${escapeIcs(b.taskId)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
